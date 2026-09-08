package net.mcpbridge.api;

/** 方法的危险等级。配置里的 permissionLevel 决定了 AI 能触达的上限。 */
public enum Permission {
    /** 只读：查询世界与玩家状态，不产生任何副作用。 */
    READ(0),
    /** 建造：放置方块、移动、说话、给物品——和玩家能做的事等价。 */
    BUILD(1),
    /** 管理：执行任意命令、改时间与天气。 */
    ADMIN(2);

    public final int level;

    Permission(int level) {
        this.level = level;
    }

    public static Permission parse(String name) {
        if (name == null) {
            return BUILD;
        }
        switch (name.trim().toLowerCase()) {
            case "read":
                return READ;
            case "build":
                return BUILD;
            case "admin":
                return ADMIN;
            default:
                return BUILD;
        }
    }
}
