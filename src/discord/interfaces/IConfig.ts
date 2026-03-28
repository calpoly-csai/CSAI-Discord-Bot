export interface IConfig {
    notion: {
        database_id: string;
    },
    discord: {
        server_id: string,
        board_role_id: string,
        auto_reaction_channel_ids: string[],
        internships: {
            channel_id: string;
        },
        logs: {
            channel_id: string;
            success_roles: string[];
            error_roles: string[];
        }
    },
}
