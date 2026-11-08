import { Component, MarkdownPostProcessor, MarkdownRenderer, Plugin, WorkspaceWindow } from 'obsidian'
import { CaptionSettings, CaptionSettingTab, DEFAULT_SETTINGS } from './settings'

const filenamePlaceholder = '%'
const filenameExtensionPlaceholder = '%.%'
const alignmentKeywords = ['left', 'right', 'center']
const embedSelector = '.image-embed, .video-embed'

export interface ParsedCaption {
  text: string;
  alignment: string;
}

export default class ImageCaptions extends Plugin {
  settings: CaptionSettings
  observers: Map<Document, MutationObserver> = new Map()

  async onload () {
    this.registerMarkdownPostProcessor(
      this.externalImageProcessor()
    )

    await this.loadSettings()
    this.addSettingTab(new CaptionSettingTab(this.app, this))

    // Watch every open window, plus any popout windows as they are opened/closed
    this.observeDocument(activeDocument)
    this.app.workspace.iterateAllLeaves(leaf => { this.observeDocument(leaf.view.containerEl.doc) })
    this.registerEvent(this.app.workspace.on('window-open', (workspaceWindow: WorkspaceWindow) => {
      this.observeDocument(workspaceWindow.doc)
    }))
    this.registerEvent(this.app.workspace.on('window-close', (workspaceWindow: WorkspaceWindow) => {
      this.observers.get(workspaceWindow.doc)?.disconnect()
      this.observers.delete(workspaceWindow.doc)
    }))
  }

  /**
   * Watch a document for changes to image embeds. Each Obsidian window has its own
   * document, so one observer is registered per window.
   */
  observeDocument (doc: Document) {
    if (this.observers.has(doc)) return
    const observer = new MutationObserver((mutations: MutationRecord[]) => {
      /*
      Search only the changed nodes, not the whole subtree of each record's target:
      N appends to one container would otherwise re-scan that container N times.
      An embed may be the changed node, sit inside it, or contain it (an <img>
      added to an existing embed).
      */
      const embeds = new Set<Element>()
      const collect = (node: Node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return
        const el = node as Element
        const container = el.closest(embedSelector)
        if (container) embeds.add(container)
        // Search for all .image-embed nodes. Could be <div> or <span>
        el.querySelectorAll(embedSelector).forEach(embed => embeds.add(embed))
      }
      mutations.forEach((rec: MutationRecord) => {
        if (rec.type === 'attributes') {
          // An attribute change adds no embeds, so only the target's own embed needs a pass
          const container = (rec.target as Element).closest(embedSelector)
          if (container) embeds.add(container)
        } else {
          rec.addedNodes.forEach(collect)
        }
      })
      embeds.forEach(imageEmbedContainer => { void this.processEmbedContainer(imageEmbedContainer) })
    })
    observer.observe(doc.body, {
      subtree: true,
      childList: true,
      /*
      Live Preview updates the alt text of an existing embed in place when the
      caption is edited, which adds no nodes. Also watch src and width, the other
      attributes processEmbedContainer reads.
      */
      attributes: true,
      attributeFilter: ['alt', 'src', 'width']
    })
    this.observers.set(doc, observer)
  }

  /**
   * Add, update, or remove the caption on a single image/video embed container.
   */
  async processEmbedContainer (imageEmbedContainer: Element) {
    // While Obsidian's native drag-resize handle is in use (Obsidian 1.13+), leave the
    // embed alone - Obsidian is updating the image width on every frame of the drag
    if (imageEmbedContainer.classList.contains('is-resizing')) return
    const img = imageEmbedContainer.querySelector('img, video')
    if (!img) return
    const width = imageEmbedContainer.getAttribute('width') || ''
    /*
    Internal embeds carry the alt/src attributes on the embed container itself.
    External images in Live Preview (Obsidian 1.13+) get an attribute-less
    container, with the caption on the img's alt attribute instead.
    */
    const isInternalEmbed = imageEmbedContainer.hasAttribute('src') || imageEmbedContainer.hasAttribute('alt')
    const caption = isInternalEmbed
      ? this.getCaptionText(imageEmbedContainer)
      : this.getExternalImageCaptionText(img)
    const figure = imageEmbedContainer.querySelector('figure')
    if (figure || img.parentElement?.nodeName === 'FIGURE') {
      // Node has already been processed - check if the caption needs to be updated
      if (figure?.classList.contains('image-captions-figure')) {
        await this.updateFigure(figure, caption)
      }
    } else if (caption.text || caption.alignment) {
      await this.insertFigureWithCaption(img as HTMLElement, imageEmbedContainer, caption, '')
    }
    /*
    Sync the width attribute from the embed container onto the image itself.
    Only for internal embeds (which carry a src attribute on the container) -
    external images in 1.13+ Live Preview get an attribute-less .image-embed
    container and Obsidian sets the width on the img directly, so removing it
    here would strip the user's specified size.
    Skip when nothing has changed, so the observer doesn't fight Obsidian's own
    width handling (e.g. during native image resizing in Obsidian 1.13+).
    */
    if (!imageEmbedContainer.hasAttribute('src')) return
    if (width && img.getAttribute('width') !== width) {
      // Update the image width, if specified
      img.setAttribute('width', width)
    } else if (!width && img.hasAttribute('width')) {
      // It's critical to remove the empty width attribute, rather than setting it to ""
      img.removeAttribute('width')
    }
  }

  /**
   * Process an HTMLElement or Element to extract the caption text and any
   * alignment keyword (left/right/center) from the alt attribute.
   *
   * Optionally use the image filename if the filenamePlaceholder is specified.
   *
   * @param img
   */
  getCaptionText (img: HTMLElement | Element): ParsedCaption {
    const parsed: ParsedCaption = { text: '', alignment: '' }
    let captionText = img.getAttribute('alt') || ''
    const src = img.getAttribute('src') || ''
    // If a wikilink is in the format [[image.png#foo]], Obsidian changes the captionText
    // to be 'image.png > foo'. We need to test for this edge case also.
    const edge = captionText.replace(/ > /, '#')
    if (captionText === src || edge === src) {
      // If no caption is specified then Obsidian puts the src in the alt attribute,
      // so we need to set a blank caption.
      return parsed
    }

    /*
    Extract any alignment keyword. These arrive as extra pipe-delimited sections
    of the alt text, e.g. ![[image.jpg|My caption|left]] gives an alt attribute
    of "My caption|left".
    */
    const sections = captionText.split('|')
    const kept: string[] = []
    for (const section of sections) {
      const keyword = section.trim().toLowerCase()
      if (alignmentKeywords.includes(keyword)) {
        parsed.alignment = keyword
      } else {
        kept.push(section)
      }
    }
    captionText = kept.join('|')

    // Perform the regex, if any
    if (this.settings.captionRegex) {
      try {
        const match = captionText.match(new RegExp(this.settings.captionRegex))
        if (match && match[1]) {
          captionText = match[1]
        } else {
          captionText = ''
        }
      } catch {
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
    parsed.text = captionText
    return parsed
  }

  /**
   * Extract the caption from an external image in Live Preview (Obsidian 1.13+).
   *
   * When no caption is specified, Obsidian fills the img's alt attribute with the
   * filename portion of the URL, so that case has to be detected and skipped.
   */
  getExternalImageCaptionText (img: Element): ParsedCaption {
    const alt = img.getAttribute('alt') || ''
    const src = img.getAttribute('src') || ''
    if (alt === src.slice(src.lastIndexOf('/') + 1)) {
      return { text: '', alignment: '' }
    }
    return this.getCaptionText(img)
  }

  /**
   * External images can be processed with a Markdown Post Processor, but only in Reading View.
   */
  externalImageProcessor (): MarkdownPostProcessor {
    return (el, ctx) => {
      el.findAll('img:not(.emoji), video')
        .forEach(img => {
          const caption = this.getCaptionText(img)
          const parent = img.parentElement
          if (parent && parent?.nodeName !== 'FIGURE' && (caption.text || caption.alignment)) {
            void this.insertFigureWithCaption(img, parent, caption, ctx.sourcePath)
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
   * In Obsidian 1.13+ Live Preview the image lives inside an .image-wrapper element
   * which also hosts the native resize handle, so in that case the whole wrapper is
   * moved inside the <figure> instead, keeping the resize handle attached to the image.
   *
   * @param {HTMLElement} imageEl - The original image element to insert inside the <figure>
   * @param {HTMLElement|Element} outerEl - Most likely the parent of the original <img>
   * @param caption
   * @param sourcePath
   */
  async insertFigureWithCaption (imageEl: HTMLElement, outerEl: HTMLElement | Element, caption: ParsedCaption, sourcePath: string) {
    const parent = imageEl.parentElement
    const content = parent?.classList.contains('image-wrapper') ? parent : imageEl
    const figure = outerEl.createEl('figure')
    figure.addClass('image-captions-figure')
    this.setFigureAlignment(figure, caption.alignment)
    figure.appendChild(content)
    if (caption.text) {
      await this.addFigCaption(figure, caption.text, sourcePath)
    }
  }

  /**
   * Update an existing figure created by this plugin: refresh the caption text and
   * alignment, or unwrap the figure entirely if the caption has been removed.
   */
  async updateFigure (figure: HTMLElement, caption: ParsedCaption) {
    const figCaption = figure.querySelector('figcaption')
    if (!caption.text && !caption.alignment) {
      // The alt-text has been removed, so remove the custom <figure> element
      // and set it back to how it was originally
      const content = figure.querySelector('.image-wrapper') || figure.querySelector('img, video')
      if (content) {
        figure.replaceWith(content)
      } else {
        figure.remove()
      }
      return
    }
    this.setFigureAlignment(figure, caption.alignment)
    if (caption.text) {
      if (figCaption?.dataset?.captionText !== caption.text) {
        // Update the text in the existing element (or create it if needed)
        figCaption?.remove()
        await this.addFigCaption(figure, caption.text, '')
      }
    } else {
      figCaption?.remove()
    }
  }

  /**
   * Render the caption markdown and append a <figcaption> element to the figure.
   */
  async addFigCaption (figure: HTMLElement, captionText: string, sourcePath: string) {
    /*
    The element (with its data attribute) is created before the async markdown
    render, so overlapping observer passes see it and don't insert a duplicate.
    */
    const figCaption = figure.createEl('figcaption', {
      cls: 'image-captions-caption',
      attr: { 'data-caption-text': captionText }
    })
    const children = await renderMarkdown(this, captionText, sourcePath) ?? [captionText]
    figCaption.replaceChildren(...children)
  }

  /**
   * Toggle the alignment class (left/right/center) on a figure element.
   */
  setFigureAlignment (figure: HTMLElement, alignment: string) {
    for (const keyword of alignmentKeywords) {
      figure.classList.toggle('image-captions-' + keyword, keyword === alignment)
    }
  }

  async loadSettings () {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings () {
    await this.saveData(this.settings)
  }

  onunload () {
    this.observers.forEach(observer => { observer.disconnect() })
    this.observers.clear()
  }
}

/**
 * Easy-to-use version of MarkdownRenderer.render. Returns only the child nodes, rather than a container block.
 * @param plugin
 * @param markdown
 * @param sourcePath
 */
export async function renderMarkdown (plugin: ImageCaptions, markdown: string, sourcePath: string): Promise<NodeList | undefined> {
  const el = createDiv()
  /*
  Captions only contain inline markdown, so a short-lived component is enough -
  nothing in the rendered output needs an ongoing lifecycle.
  */
  const component = new Component()
  component.load()
  try {
    await MarkdownRenderer.render(plugin.app, markdown, el, sourcePath, component)
    for (const child of el.children) {
      if (child.tagName.toLowerCase() === 'p') {
        return child.childNodes
      }
    }
  } finally {
    component.unload()
  }
}
