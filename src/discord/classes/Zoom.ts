import { ChatInputCommandInteraction } from "discord.js";
import SubCommand from "../classes/SubCommand";
import DiscordClient from "../classes/DiscordClient";

export default class Zoom extends SubCommand {
  constructor(client: DiscordClient) {
    super(client, {
      name: "zoom",
    });
  }

  async Execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({
      content: process.env.ZOOM_LINK ?? "Zoom link",
    });
  }
}