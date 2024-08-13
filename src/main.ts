import { Component, MarkdownPostProcessor, MarkdownRenderer, Plugin } from 'obsidian'
import { CaptionSettings, CaptionSettingTab, DEFAULT_SETTINGS } from './settings'

const filenamePlaceholder = '%'
const filenameExtensionPlaceholder = '%.%'

export default class ImageCaptions extends Plugin {
  settings: CaptionSettings
  observer: MutationObserver

  async onload () {
    this.registerMarkdownPostProcessor(
      this.externalImageProcessor()
    )

    await this.loadSettings()
    this.addSettingTab(new CaptionSettingTab(this.app, this))

    this.observer = new MutationObserver((mutations: MutationRecord[]) => {
      mutations.forEach((rec: MutationRecord) => {
        if (rec.type === 'childList') {
          (<Element>rec.target)
            // Search for all .image-embed nodes. Could be <div> or <span>
            .querySelectorAll('.image-embed')
            .forEach(async imageEmbedContainer => {
              const img = imageEmbedContainer.querySelector('img')
              const width = imageEmbedContainer.getAttribute('width') || ''
              const captionText = this.getCaptionText(imageEmbedContainer)
              if (!img) return
              const figure = imageEmbedContainer.querySelector('figure')
              const figCaption = imageEmbedContainer.querySelector('figcaption')
              if (figure || img.parentElement?.nodeName === 'FIGURE') {
                // Node has already been processed
                // Check if the text needs to be updated
                if (figCaption && captionText) {
                  // Update the text in the existing element
                  const children = await renderMarkdown(captionText, '', this) ?? [captionText]
                  figCaption.replaceChildren(...children)
                } else if (!captionText) {
                  // The alt-text has been removed, so remove the custom <figure> element
                  // and set it back to how it was originally with just the plain <img> element
                  imageEmbedContainer.appendChild(img)
                  figure?.remove()
                }
              } else {
                if (captionText && captionText !== imageEmbedContainer.getAttribute('src')) {
                  await this.insertFigureWithCaption(img, imageEmbedContainer, captionText, '')
                }
              }
              if (width) {
                // Update the image width, if specified
                img.setAttribute('width', width)
              } else {
                // It's critical to remove the empty width attribute, rather than setting it to ""
                img.removeAttribute('width')
              }
            })
        }
      })
    })
    this.observer.observe(document.body, {
      subtree: true,
      childList: true
    })
  }

  /**
   * Process an HTMLElement or Element to extract the caption text
   * from the alt attribute.
   *
   * Optionally use the image filename if the filenamePlaceholder is specified.
   *
   * @param img
   */
  getCaptionText (img: HTMLElement | Element) {
    let captionText = img.getAttribute('alt') || ''
    const src = img.getAttribute('src') || ''
    if (captionText === src) {
      // If no caption is specified then Obsidian puts the src in the alt attribute,
      // so we need to set a blank caption.
      return ''
    }

    // Perform the regex, if any
    if (this.settings.captionRegex) {
      try {
        const match = captionText.match(new RegExp(this.settings.captionRegex))
        if (match && match[1]) captionText = match[1]
      } catch (e) {
        // Invalid regex
      }
    }

    if (captionText === filenamePlaceholder) {
      // Optionally use filename as caption text if the placeholder is used
      const match = src.match(/[^\\/]+(?=\.\w+$)|[^\\/]+$/)
      if (match?.[0]) {
        captionText = match[0]
      }
    } else if (captionText === filenameExtensionPlaceholder) {
      // Optionally use filename (including extension) as caption text if the placeholder is used
      const match = src.match(/[^\\/]+$/)
      if (match?.[0]) {
        captionText = match[0]
      }
    } else if (captionText === '\\' + filenamePlaceholder) {
      // Remove the escaping to allow the placeholder to be used verbatim
      captionText = filenamePlaceholder
    }
    captionText = captionText.replace(/<<(.*?)>>/g, (_, linktext) => {
      return '[[' + linktext + ']]'
    })
    return captionText
  }

  /**
   * External images can be processed with a Markdown Post Processor, but only in Reading View.
   */
  externalImageProcessor (): MarkdownPostProcessor {
    return (el, ctx) => {
      el.findAll('img:not(.emoji)')
        .forEach(async img => {
          const captionText = this.getCaptionText(img)
          const parent = img.parentElement
          if (parent && parent?.nodeName !== 'FIGURE' && captionText && captionText !== img.getAttribute('src')) {
            await this.insertFigureWithCaption(img, parent, captionText, ctx.sourcePath)
          }
        })
    }
  }

  /**
   * Replace the original <img> element with this structure:
   * @example
   * <figure>
   *   <img>
   *   <figcaption>The caption text</figcaption>
   * </figure>
   *
   * @param {HTMLElement} imageEl - The original image element to insert inside the <figure>
   * @param {HTMLElement|Element} outerEl - Most likely the parent of the original <img>
   * @param captionText
   * @param sourcePath
   */
  async insertFigureWithCaption (imageEl: HTMLElement, outerEl: HTMLElement | Element, captionText: string, sourcePath: string) {
    const figure = outerEl.createEl('figure')
    figure.addClass('image-captions-figure')
    figure.appendChild(imageEl)
    const children = await renderMarkdown(captionText, sourcePath, this) ?? [captionText]
    figure.createEl('figcaption', {
      cls: 'image-captions-caption'
    }).replaceChildren(...children)
  }

  async loadSettings () {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings () {
    await this.saveData(this.settings)
  }

  onunload () {
    this.observer.disconnect()
  }
}

/**
 * Easy-to-use version of MarkdownRenderer.renderMarkdown. Returns only the child nodes, rather than a container block.
 * @param markdown
 * @param sourcePath
 * @param component - Typically you can just pass the plugin instance, but Liam from the Obsidian team says
 *   it's not a good practice (https://github.com/obsidianmd/obsidian-releases/pull/2263#issuecomment-1711864829).
 *   I'm currently struggling to find a proper way to do it.
 */
export async function renderMarkdown (markdown: string, sourcePath: string, component: Component): Promise<NodeList | undefined> {
  const el = createDiv()
  await MarkdownRenderer.renderMarkdown(markdown, el, sourcePath, component)
  for (const child of el.children) {
    if (child.tagName.toLowerCase() === 'p') {
      return child.childNodes
    }
  }
}
