import { world, system, BlockPermutation } from "@minecraft/server";

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { block, player, itemStack } = event;

    // 1. 检查工具和方块
    if (!itemStack || !itemStack.typeId.endsWith("_pickaxe")) return;
    if (block.typeId !== "minecraft:vault") return;

    // 2. 取消原版交互
    event.cancel = true;

    // 3. 保存关键信息：位置、维度、旧状态
    // 必须在这里把数据存下来，因为一会方块就没了
    const dimension = block.dimension;
    const location = block.location;
    const oldPermutation = block.permutation;
    
    // 提取状态
    const facing = oldPermutation.getState("minecraft:cardinal_direction") ?? "north";
    const isOminous = oldPermutation.getState("ominous") ?? false;

    // 4. 延迟执行重置逻辑
    system.run(() => {
        try {
            // --- 第一步：变成空气 ---
            // 使用 dimension.getBlock(location) 确保我们操作的是这个坐标
            const targetBlock = dimension.getBlock(location);
            
            if (targetBlock) {
                targetBlock.setType("minecraft:air");
            }

            // --- 第二步：变回宝库 ---
            // 为了确保数据被彻底清除，我们在下一帧再放回去
            system.run(() => {
                try {
                    // 重新获取该位置（因为变成空气后，之前的引用可能不稳）
                    const newBlock = dimension.getBlock(location);
                    
                        if (newBlock) {
                            if (isOminous) {
                                // ominous为true时加载结构文件，并根据朝向旋转
                                let rotation = 0;
                                switch (facing) {
                                    case "north": rotation = 0; break;
                                    case "east": rotation = 90; break;
                                    case "south": rotation = 180; break;
                                    case "west": rotation = 270; break;
                                }
                                try {
                                    dimension.runCommandAsync(`structure load pickaxe_reset_vault:ominous_vault ${location.x} ${location.y} ${location.z} ${rotation}_degrees`);
                                    dimension.playSound("random.orb", location);
                                    //player.onScreenDisplay.setActionBar("§aOminous Vault loaded!");
                                } catch (err) {
                                    world.sendMessage(`§7[Pickaxe Reset Vault]加载结构出错: ${err}`);
                                }
                            } else {
                                // 创建全新的状态
                                const newPerm = BlockPermutation.resolve("minecraft:vault", {
                                    "minecraft:cardinal_direction": facing,
                                    "ominous": isOminous
                                });
                                newBlock.setPermutation(newPerm);
                                dimension.playSound("random.orb", location);
                                //player.onScreenDisplay.setActionBar("§aVault reset!");
                            }
                        }
                } catch (error) {
                    // 如果第二步出错，告诉玩家
                    world.sendMessage(`§7[Pickaxe Reset Vault]重置第二步出错: ${error}`);
                }
            });

        } catch (error) {
            // 如果第一步出错，告诉玩家
            world.sendMessage(`§7[Pickaxe Reset Vault]重置第一步出错: ${error}`);
        }
    });
});