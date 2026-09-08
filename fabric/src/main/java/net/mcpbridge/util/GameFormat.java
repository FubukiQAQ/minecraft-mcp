package net.mcpbridge.util;

import com.google.gson.JsonObject;
import net.mcpbridge.api.RpcException;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.state.property.Property;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

import java.util.Optional;

/** 游戏对象 <-> JSON 的转换，以及 ID 字符串 -> 注册表对象的解析。 */
public final class GameFormat {

    private GameFormat() {
    }

    public static JsonObject pos(BlockPos p) {
        JsonObject j = new JsonObject();
        j.addProperty("x", p.getX());
        j.addProperty("y", p.getY());
        j.addProperty("z", p.getZ());
        return j;
    }

    public static JsonObject vec(Vec3d v) {
        JsonObject j = new JsonObject();
        j.addProperty("x", round(v.getX()));
        j.addProperty("y", round(v.getY()));
        j.addProperty("z", round(v.getZ()));
        return j;
    }

    public static JsonObject blockState(BlockState state) {
        JsonObject j = new JsonObject();
        Identifier id = Registries.BLOCK.getId(state.getBlock());
        j.addProperty("block", id == null ? "minecraft:air" : id.toString());
        j.addProperty("isAir", state.isAir());
        JsonObject props = new JsonObject();
        for (Property<?> prop : state.getBlock().getStateManager().getProperties()) {
            props.addProperty(prop.getName(), String.valueOf(read(state, prop)));
        }
        j.add("properties", props);
        return j;
    }

    public static JsonObject item(ItemStack stack) {
        JsonObject j = new JsonObject();
        if (stack == null || stack.isEmpty()) {
            j.addProperty("empty", true);
            return j;
        }
        Identifier id = Registries.ITEM.getId(stack.getItem());
        j.addProperty("item", id == null ? "unknown" : id.toString());
        j.addProperty("count", stack.getCount());
        j.addProperty("damage", stack.getDamage());
        j.addProperty("name", stack.getName().getString());
        return j;
    }

    public static JsonObject entity(Entity e) {
        JsonObject j = new JsonObject();
        j.addProperty("uuid", e.getUuid().toString());
        Identifier typeId = Registries.ENTITY_TYPE.getId(e.getType());
        j.addProperty("type", typeId == null ? "unknown" : typeId.toString());
        j.addProperty("name", e.getName().getString());
        j.addProperty("x", round(e.getX()));
        j.addProperty("y", round(e.getY()));
        j.addProperty("z", round(e.getZ()));
        j.addProperty("alive", e.isAlive());
        if (e instanceof LivingEntity living) {
            j.addProperty("health", round(living.getHealth()));
            j.addProperty("maxHealth", round(living.getMaxHealth()));
        }
        return j;
    }

    /** 解析 "minecraft:oak_stairs" 这类 ID，可选带上 properties 对象。 */
    public static BlockState parseBlockState(String id, JsonObject properties) throws RpcException {
        Block block = resolveBlock(id);
        BlockState state = block.getDefaultState();
        if (properties == null) {
            return state;
        }
        for (java.util.Map.Entry<String, com.google.gson.JsonElement> e : properties.entrySet()) {
            Property<?> prop = state.getBlock().getStateManager().getProperty(e.getKey());
            if (prop == null) {
                throw new RpcException(-32602, "方块 " + id + " 没有属性 " + e.getKey());
            }
            state = withValue(state, prop, e.getValue().getAsString());
        }
        return state;
    }

    public static Block resolveBlock(String id) throws RpcException {
        Identifier ident = Identifier.tryParse(id);
        if (ident == null) {
            throw new RpcException(-32602, "非法的方块 ID: " + id);
        }
        Optional<Block> block = Registries.BLOCK.getOrEmpty(ident);
        if (block.isEmpty()) {
            throw new RpcException(-32602, "未知方块: " + id);
        }
        return block.get();
    }

    public static Item resolveItem(String id) throws RpcException {
        Identifier ident = Identifier.tryParse(id);
        if (ident == null) {
            throw new RpcException(-32602, "非法的物品 ID: " + id);
        }
        Optional<Item> item = Registries.ITEM.getOrEmpty(ident);
        if (item.isEmpty()) {
            throw new RpcException(-32602, "未知物品: " + id);
        }
        return item.get();
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static BlockState withValue(BlockState state, Property prop, String raw) throws RpcException {
        Optional parsed = prop.parse(raw);
        if (parsed.isEmpty()) {
            throw new RpcException(-32602,
                    "属性 " + prop.getName() + " 不接受取值 " + raw);
        }
        return state.with(prop, (Comparable) parsed.get());
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static Object read(BlockState state, Property prop) {
        return state.get(prop);
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
