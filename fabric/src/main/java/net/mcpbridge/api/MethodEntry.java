package net.mcpbridge.api;

import com.google.gson.JsonObject;

/** 一个可被外部调用的方法（= MCP server 里的一个 tool）。 */
public final class MethodEntry {

    public final String name;
    public final String description;
    public final Permission required;
    public final JsonObject schema;
    public final MethodHandler handler;

    public MethodEntry(String name, String description, Permission required, JsonObject schema, MethodHandler handler) {
        this.name = name;
        this.description = description;
        this.required = required;
        this.schema = schema;
        this.handler = handler;
    }

    public JsonObject toJson() {
        JsonObject j = new JsonObject();
        j.addProperty("name", name);
        j.addProperty("description", description);
        j.addProperty("permission", required.name().toLowerCase());
        j.add("schema", schema);
        return j;
    }
}
