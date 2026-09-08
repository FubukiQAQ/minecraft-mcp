package net.mcpbridge.client.gui;

import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;
import net.mcpbridge.McpBridgeMod;
import net.mcpbridge.config.ModConfig;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;

/**
 * 游戏内的 MCP Bridge 设置界面（Esc 菜单按钮进入）。
 *
 * 编辑的是配置的一份草稿：点「保存并应用」才写回运行中的实例并即时生效，点「取消」或按 Esc 直接丢弃。
 * 其中端口 / 绑定地址 / 启用开关需要重启 HTTP 桥，其余配置每次请求现场读取，改完即可用。
 */
@Environment(EnvType.CLIENT)
public final class ConfigScreen extends Screen {

    private static final int ROW_HEIGHT = 26;
    private static final int TOP = 36;
    private static final int BOTTOM_MARGIN = 56;

    private final Screen parent;
    private ModConfig draft;

    public ConfigScreen(Screen parent) {
        this(parent, ModConfig.get().copy());
    }

    public ConfigScreen(Screen parent, ModConfig draft) {
        super(Text.translatable("mcpbridge.title"));
        this.parent = parent;
        this.draft = draft;
    }

    @Override
    protected void init() {
        ConfigListWidget list = new ConfigListWidget(this.client, this.width, this.height, TOP,
                this.height - BOTTOM_MARGIN, ROW_HEIGHT);
        this.addDrawableChild(list);
        buildRows(list);

        int y = this.height - 32;
        this.addDrawableChild(ButtonWidget
                .builder(Text.translatable("mcpbridge.action.reset"), button -> resetDefaults())
                .dimensions(this.width / 2 - 152, y, 98, 20)
                .build());
        this.addDrawableChild(ButtonWidget
                .builder(Text.translatable("gui.cancel"), button -> close())
                .dimensions(this.width / 2 - 50, y, 98, 20)
                .build());
        this.addDrawableChild(ButtonWidget
                .builder(Text.translatable("mcpbridge.action.save"), button -> saveAndClose())
                .dimensions(this.width / 2 + 52, y, 98, 20)
                .build());
    }

    // ------------------------------------------------------------------ 行

    private void buildRows(ConfigListWidget list) {
        ModConfig c = draft;

        list.addEntry(new ConfigListWidget.CategoryRow(Text.translatable("mcpbridge.cat.network")));
        list.addEntry(new ConfigListWidget.BooleanRow(Text.translatable("mcpbridge.opt.enabled"),
                c.enabled, v -> c.enabled = v));
        list.addEntry(new ConfigListWidget.TextRow(Text.translatable("mcpbridge.opt.bindAddress"),
                c.bindAddress, 140, null, v -> c.bindAddress = v.trim()));
        list.addEntry(new ConfigListWidget.TextRow(Text.translatable("mcpbridge.opt.port"),
                String.valueOf(c.port), 80, intFilter(), v -> c.port = parseInt(v, c.port)));
        list.addEntry(new ConfigListWidget.BooleanRow(Text.translatable("mcpbridge.opt.allowRemoteBinding"),
                c.allowRemoteBinding, v -> c.allowRemoteBinding = v));

        list.addEntry(new ConfigListWidget.CategoryRow(Text.translatable("mcpbridge.cat.security")));
        list.addEntry(new ConfigListWidget.CycleRow(Text.translatable("mcpbridge.opt.permissionLevel"),
                List.of("read", "build", "admin"), c.permissionLevel, 100, v -> c.permissionLevel = v));
        list.addEntry(tokenRow());
        list.addEntry(new ConfigListWidget.CycleRow(Text.translatable("mcpbridge.opt.commandMode"),
                List.of("off", "denylist", "allowlist"), c.commandMode, 110, v -> c.commandMode = v));
        list.addEntry(new ConfigListWidget.TextRow(Text.translatable("mcpbridge.opt.commandDenylist"),
                join(c.commandDenylist), 220, null, v -> c.commandDenylist = split(v)));
        list.addEntry(new ConfigListWidget.TextRow(Text.translatable("mcpbridge.opt.commandAllowlist"),
                join(c.commandAllowlist), 200, null, v -> c.commandAllowlist = split(v)));
        list.addEntry(new ConfigListWidget.TextRow(Text.translatable("mcpbridge.opt.requestTimeoutMs"),
                String.valueOf(c.requestTimeoutMs), 80, intFilter(),
                v -> c.requestTimeoutMs = parseInt(v, c.requestTimeoutMs)));

        list.addEntry(new ConfigListWidget.CategoryRow(Text.translatable("mcpbridge.cat.limits")));
        list.addEntry(new ConfigListWidget.TextRow(Text.translatable("mcpbridge.opt.maxScanVolume"),
                String.valueOf(c.maxScanVolume), 100, intFilter(),
                v -> c.maxScanVolume = parseInt(v, c.maxScanVolume)));
        list.addEntry(new ConfigListWidget.TextRow(Text.translatable("mcpbridge.opt.maxFillVolume"),
                String.valueOf(c.maxFillVolume), 100, intFilter(),
                v -> c.maxFillVolume = parseInt(v, c.maxFillVolume)));
        list.addEntry(new ConfigListWidget.TextRow(Text.translatable("mcpbridge.opt.maxRaycastDistance"),
                String.valueOf(c.maxRaycastDistance), 80, intFilter(),
                v -> c.maxRaycastDistance = parseInt(v, c.maxRaycastDistance)));
        list.addEntry(new ConfigListWidget.TextRow(Text.translatable("mcpbridge.opt.maxEntitiesReturned"),
                String.valueOf(c.maxEntitiesReturned), 80, intFilter(),
                v -> c.maxEntitiesReturned = parseInt(v, c.maxEntitiesReturned)));

        list.addEntry(new ConfigListWidget.CategoryRow(Text.translatable("mcpbridge.cat.events")));
        list.addEntry(new ConfigListWidget.BooleanRow(Text.translatable("mcpbridge.opt.eventLog"),
                c.eventLog, v -> c.eventLog = v));
        list.addEntry(new ConfigListWidget.TextRow(Text.translatable("mcpbridge.opt.eventLogSize"),
                String.valueOf(c.eventLogSize), 80, intFilter(),
                v -> c.eventLogSize = parseInt(v, c.eventLogSize)));
        list.addEntry(new ConfigListWidget.BooleanRow(Text.translatable("mcpbridge.opt.logMobDeaths"),
                c.logMobDeaths, v -> c.logMobDeaths = v));
    }

    /** 令牌这一行比较特殊：输入框旁边带「重新生成」和「复制」两个小按钮。 */
    private ConfigListWidget.LabeledRow tokenRow() {
        ConfigListWidget.LabeledRow row =
                new ConfigListWidget.LabeledRow(Text.translatable("mcpbridge.opt.token"));
        TextFieldWidget field =
                ConfigListWidget.textField(draft.token, 150, null, v -> draft.token = v.trim());
        row.add(field);
        row.add(ButtonWidget
                .builder(Text.translatable("mcpbridge.action.regenerate"), button -> {
                    String token = ModConfig.newToken();
                    field.setText(token);
                    draft.token = token;
                })
                .dimensions(0, 0, 56, 20)
                .build());
        row.add(ButtonWidget
                .builder(Text.translatable("mcpbridge.action.copy"),
                        button -> client.keyboard.setClipboard(field.getText()))
                .dimensions(0, 0, 40, 20)
                .build());
        return row;
    }

    // ------------------------------------------------------------------ 行为

    private void saveAndClose() {
        ModConfig live = ModConfig.get();
        live.copyFrom(draft);
        live.applyRuntime();
        McpBridgeMod.applyNetworkConfig();
        close();
    }

    private void resetDefaults() {
        ModConfig fresh = new ModConfig();
        // 令牌不在默认值里（是 load 时才生成的），保留当前值，免得把已配好的 MCP server 顶掉
        fresh.token = draft.token == null || draft.token.isBlank() ? ModConfig.newToken() : draft.token;
        ModConfig next = ModConfig.get().copy();
        next.copyFrom(fresh);
        this.draft = next;
        if (this.client != null) {
            this.client.setScreen(new ConfigScreen(parent, next));
        }
    }

    @Override
    public void close() {
        if (this.client != null) {
            this.client.setScreen(parent);
        }
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        this.renderBackgroundTexture(context);
        // 列表已经作为 child 加进来了，super 会画它和底部按钮，这里不要再画一遍
        super.render(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, this.title, this.width / 2, 12, 0xFFFFFF);
        context.drawCenteredTextWithShadow(this.textRenderer,
                Text.translatable("mcpbridge.status", McpBridgeMod.httpStatus()),
                this.width / 2, this.height - 46, 0xAAAAAA);
    }

    // ------------------------------------------------------------------ 小工具

    private static int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static String join(List<String> values) {
        return values == null ? "" : String.join(",", values);
    }

    private static List<String> split(String value) {
        List<String> out = new ArrayList<>();
        if (value == null) {
            return out;
        }
        for (String part : value.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                out.add(trimmed);
            }
        }
        return out;
    }

    /** 只放数字，留空表示"先不改"。 */
    private static java.util.function.Predicate<String> intFilter() {
        return text -> text.isEmpty() || text.matches("\\d{1,9}");
    }
}
