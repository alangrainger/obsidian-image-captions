import { App, PluginSettingTab, Setting } from 'obsidian'
import ImageCaptions from './main'

export interface CaptionSettings {
  captionRegex: string;
}

export const DEFAULT_SETTINGS: CaptionSettings = {
  captionRegex: ''
}

export class CaptionSettingTab extends PluginSettingTab {
  plugin: ImageCaptions

  constructor (app: App, plugin: ImageCaptions) {
    super(app, plugin)
    this.plugin = plugin
  }

  display (): void {
    const { containerEl } = this

    containerEl.empty()

    new Setting(containerEl)
      .setName('Advanced settings')
      .setHeading()

    // Caption regex
    new Setting(containerEl)
      .setName('Caption regex')
      .setDesc('For advanced caption parsing, you can add a regex here. The first capturing group will be used as the image caption. ' +
        'This is useful in situations where you might have another plugin or theme adding text to the caption area which you want to strip out. ' +
        'The placeholder example would be used to exclude everything following a pipe character (if one exists).')
      .addText(text => text
        .setPlaceholder('^([^|]+)')
        .setValue(this.plugin.settings.captionRegex)
        .onChange(async value => {
          this.plugin.settings.captionRegex = value
          await this.plugin.saveSettings()
        }))
  }
}
