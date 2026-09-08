package net.mcpbridge.api;

import com.google.gson.JsonObject;

import java.util.LinkedHashMap;
import java.util.Map;

/** 用于自检与文档生成的极简 JSON Schema 描述（够用即可，不作严格校验）。 */
public final class Schema {

    private Schema() {
    }

    /** 交替传入 参数名/类型，如 props("x","integer","y","integer")。 */
    public static Map<String, String> props(Object... kv) {
        LinkedHashMap<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            map.put(String.valueOf(kv[i]), String.valueOf(kv[i + 1]));
        }
        return map;
    }

    public static JsonObject of(String description, Map<String, String> properties, String... required) {
        JsonObject props = new JsonObject();
        for (Map.Entry<String, String> e : properties.entrySet()) {
            JsonObject t = new JsonObject();
            t.addProperty("type", e.getValue());
            props.add(e.getKey(), t);
        }
        com.google.gson.JsonArray requiredArray = new com.google.gson.JsonArray();
        for (String r : required) {
            requiredArray.add(r);
        }
        JsonObject schema = new JsonObject();
        schema.addProperty("type", "object");
        schema.add("properties", props);
        schema.add("required", requiredArray);
        if (description != null && !description.isEmpty()) {
            schema.addProperty("description", description);
        }
        return schema;
    }

    public static JsonObject of(String description) {
        return of(description, new LinkedHashMap<>());
    }
}
