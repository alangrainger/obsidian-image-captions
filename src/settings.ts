import { App, PluginSettingTab, Setting } from 'obsidian'
import ImageCaptions from './main'

export interface CaptionSettings {
  captionRegex: string;
  captionImgColor: string;
  captionBckColor: string;
}

export const DEFAULT_SETTINGS: CaptionSettings = {
  captionRegex: '',
  captionBckColor: '--color-base-30',
  captionImgColor: '--color-base-30',
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

    const colorHelper = 'Could be an hexadecimal value, a css value (e.g. "--color-base-30") or a string value (e.g. "yellow"'
    new Setting(containerEl)
      .setName('Caption background color')
      .setDesc('Choose the color of the backgroud of the caption.' + colorHelper)
      .addText(text => text
        .setValue(this.plugin.settings.captionBckColor)
        .onChange(async value => {
          this.plugin.settings.captionBckColor = value
          await this.plugin.saveSettings()
        }))
      .addButton(btn => btn
        .setIcon("rotate-ccw")
        .onClick(async value => {
            this.plugin.settings.captionBckColor = DEFAULT_SETTINGS.captionBckColor
            await this.plugin.saveSettings()
            this.display()
        }))

    new Setting(containerEl)
      .setName('Image background color')
      .setDesc('Choose the color of the image background' + colorHelper)
      .addText(text => text
        .setValue(this.plugin.settings.captionImgColor)
        .onChange(async value => {
          this.plugin.settings.captionImgColor = value
          await this.plugin.saveSettings()
        }))
      .addButton(btn => btn
        .setIcon("rotate-ccw")
        .onClick(async value => {
            this.plugin.settings.captionImgColor = DEFAULT_SETTINGS.captionImgColor
            await this.plugin.saveSettings()
            this.display()
        }))
  }
}
