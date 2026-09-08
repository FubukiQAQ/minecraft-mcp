package net.mcpbridge.client;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.Screens;
import net.mcpbridge.client.gui.ConfigScreen;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.GameMenuScreen;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.ClickableWidget;
import net.minecraft.text.Text;

import java.util.List;

/**
 * 客户端入口：在 Esc 菜单（GameMenuScreen）里挂一个独立的「MCP Bridge 设置」按钮。
 *
 * 没有用 mixin 改布局，而是借 Fabric 的 ScreenEvents.AFTER_INIT 在原版初始化完成后追加一个按钮，
 * 位置按现有按钮的包围盒算出来（贴在最后一行下面），这样 MC 小版本改布局也不会直接崩。
 */
@Environment(EnvType.CLIENT)
public final class McpBridgeClient implements ClientModInitializer {

    private static final int BUTTON_WIDTH = 204;
    private static final int BUTTON_HEIGHT = 20;

    @Override
    public void onInitializeClient() {
        ScreenEvents.AFTER_INIT.register((client, screen, scaledWidth, scaledHeight) -> {
            if (screen instanceof GameMenuScreen) {
                addMenuButton(client, screen);
            }
        });
    }

    private static void addMenuButton(MinecraftClient client, Screen screen) {
        List<ClickableWidget> buttons = Screens.getButtons(screen);
        // GameMenuScreen 在"正在保存世界"状态下没有按钮，那种界面不塞设置入口
        if (buttons.isEmpty()) {
            return;
        }
        int x = screen.width / 2 - BUTTON_WIDTH / 2;
        int bottom = 0;
        for (ClickableWidget existing : buttons) {
            bottom = Math.max(bottom, existing.getY() + existing.getHeight());
        }
        int y = bottom + 4;
        // 小窗口时挤不进去就贴底，宁可压住一点也不要被裁掉
        y = Math.min(y, screen.height - BUTTON_HEIGHT - 6);
        y = Math.max(y, 6);

        buttons.add(ButtonWidget
                .builder(Text.translatable("mcpbridge.menuButton"),
                        button -> client.setScreen(new ConfigScreen(screen)))
                .dimensions(x, y, BUTTON_WIDTH, BUTTON_HEIGHT)
                .build());
    }
}
