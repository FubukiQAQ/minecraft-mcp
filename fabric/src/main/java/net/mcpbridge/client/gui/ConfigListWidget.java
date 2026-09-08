package net.mcpbridge.client.gui;

import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.Element;
import net.minecraft.client.gui.Selectable;
import net.minecraft.client.gui.screen.narration.NarrationMessageBuilder;
import net.minecraft.client.gui.widget.CheckboxWidget;
import net.minecraft.client.gui.widget.ClickableWidget;
import net.minecraft.client.gui.widget.CyclingButtonWidget;
import net.minecraft.client.gui.widget.ElementListWidget;
import net.minecraft.client.gui.widget.EntryListWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Predicate;

/**
 * 配置界面用的可滚动列表。
 *
 * 每行是一个 {@link Row}：左侧画标签，右侧的控件右对齐。控件的绝对坐标在 render 里
 * 现算（x 由列表给出，y 随滚动变化），这样滚动时点击判定跟着一起动。
 */
@Environment(EnvType.CLIENT)
public final class ConfigListWidget extends EntryListWidget<ConfigListWidget.Row> {

    private static final int ROW_WIDTH_MAX = 396;

    public ConfigListWidget(MinecraftClient client, int width, int height, int top, int bottom, int itemHeight) {
        super(client, width, height, top, bottom, itemHeight);
    }

    /** 放宽 {@link EntryListWidget#addEntry} 的访问级别，方便界面里直接加行。 */
    @Override
    public int addEntry(Row entry) {
        return super.addEntry(entry);
    }

    @Override
    public int getRowWidth() {
        return Math.min(this.width - 24, ROW_WIDTH_MAX);
    }

    @Override
    protected int getScrollbarPositionX() {
        return this.left + this.width / 2 + this.getRowWidth() / 2 + 6;
    }

    /** 朗读支持从简：配置界面不逐行念控件，交给屏幕标题即可。 */
    @Override
    public void appendNarrations(NarrationMessageBuilder builder) {
    }

    // ------------------------------------------------------------------ 行

    @Environment(EnvType.CLIENT)
    public abstract static class Row extends ElementListWidget.Entry<Row> {

        protected final MinecraftClient client = MinecraftClient.getInstance();
        private final List<ClickableWidget> widgets = new ArrayList<>();

        public void add(ClickableWidget widget) {
            widgets.add(widget);
        }

        @Override
        public List<? extends Element> children() {
            return widgets;
        }

        @Override
        public List<? extends Selectable> selectableChildren() {
            return widgets;
        }

        /** 把子控件摆到本行的位置上，整组右对齐；add 的顺序就是从左到右的显示顺序。 */
        protected void layout(int x, int y, int rowWidth, int rowHeight) {
            int cursor = x + rowWidth;
            for (int i = widgets.size() - 1; i >= 0; i--) {
                ClickableWidget widget = widgets.get(i);
                cursor -= widget.getWidth();
                widget.setX(cursor);
                widget.setY(y + (rowHeight - widget.getHeight()) / 2);
                cursor -= 4;
            }
        }

        /** 画左侧标签（子类需要时重写）。 */
        protected void renderLabel(DrawContext context, int x, int y, int rowWidth, int rowHeight) {
        }

        @Override
        public void render(DrawContext context, int index, int y, int x, int rowWidth, int rowHeight,
                           int mouseX, int mouseY, boolean hovered, float tickDelta) {
            layout(x, y, rowWidth, rowHeight);
            renderLabel(context, x, y, rowWidth, rowHeight);
            for (ClickableWidget widget : widgets) {
                widget.render(context, mouseX, mouseY, tickDelta);
            }
        }
    }

    /** 分组标题，独占一行，没有控件。 */
    @Environment(EnvType.CLIENT)
    public static final class CategoryRow extends Row {

        private final Text text;

        public CategoryRow(Text text) {
            this.text = text;
        }

        @Override
        public void render(DrawContext context, int index, int y, int x, int rowWidth, int rowHeight,
                           int mouseX, int mouseY, boolean hovered, float tickDelta) {
            context.drawCenteredTextWithShadow(client.textRenderer, text,
                    x + rowWidth / 2, y + (rowHeight - client.textRenderer.fontHeight) / 2 + 1, 0xAAAAAA);
        }
    }

    /** 带左侧标签的行。 */
    @Environment(EnvType.CLIENT)
    public static class LabeledRow extends Row {

        private final Text label;

        public LabeledRow(Text label) {
            this.label = label;
        }

        @Override
        protected void renderLabel(DrawContext context, int x, int y, int rowWidth, int rowHeight) {
            int textY = y + (rowHeight - client.textRenderer.fontHeight) / 2 + 1;
            context.drawTextWithShadow(client.textRenderer, label, x, textY, 0xFFFFFF);
        }
    }

    /** 开关。 */
    @Environment(EnvType.CLIENT)
    public static final class BooleanRow extends LabeledRow {

        public BooleanRow(Text label, boolean initial, Consumer<Boolean> onChanged) {
            super(label);
            add(new CheckboxWidget(0, 0, 20, 20, Text.empty(), initial, false) {
                @Override
                public void onPress() {
                    super.onPress();
                    onChanged.accept(isChecked());
                }
            });
        }
    }

    /** 多选一（授权等级、命令模式这类）。 */
    @Environment(EnvType.CLIENT)
    public static final class CycleRow extends LabeledRow {

        public CycleRow(Text label, List<String> values, String initial, int width, Consumer<String> onChanged) {
            super(label);
            String current = values.contains(initial) ? initial : values.get(0);
            add(CyclingButtonWidget.<String>builder(Text::literal)
                    .values(values)
                    .initially(current)
                    .omitKeyText()
                    .build(0, 0, width, 20, Text.empty(), (button, value) -> onChanged.accept(value)));
        }
    }

    /** 文本 / 数字输入。 */
    @Environment(EnvType.CLIENT)
    public static final class TextRow extends LabeledRow {

        private final TextFieldWidget field;

        public TextRow(Text label, String initial, int width, Predicate<String> filter, Consumer<String> onChanged) {
            super(label);
            this.field = textField(initial, width, filter, onChanged);
            add(this.field);
        }

        public TextFieldWidget field() {
            return field;
        }
    }

    /** 单独做一个输入框（令牌那行要自己排版，不用 TextRow 的右对齐布局）。 */
    public static TextFieldWidget textField(String initial, int width,
                                            Predicate<String> filter, Consumer<String> onChanged) {
        TextFieldWidget field = new TextFieldWidget(MinecraftClient.getInstance().textRenderer,
                0, 0, width, 18, Text.empty());
        field.setMaxLength(1024);
        field.setText(initial == null ? "" : initial);
        field.setTextPredicate(filter == null ? text -> true : filter);
        field.setChangedListener(onChanged);
        return field;
    }
}
