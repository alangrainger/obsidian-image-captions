import { MarkdownPostProcessor, Plugin } from 'obsidian'

export default class ImageCaptions extends Plugin {
  observer: MutationObserver

  async onload () {
    this.registerMarkdownPostProcessor(
      externalImageProcessor()
    )

    this.observer = new MutationObserver((mutations: MutationRecord[]) => {
      mutations.forEach((rec: MutationRecord) => {
        if (rec.type === 'childList') {
          (<Element>rec.target)
            // Search for all .image-embed nodes. Could be <div> or <span>
            .querySelectorAll('.image-embed')
            .forEach(imageEmbedContainer => {
              const img = imageEmbedContainer.querySelector('img')
              let captionText = imageEmbedContainer.getAttribute('alt') || ''
              const width = imageEmbedContainer.getAttribute('width') || ''
              if (captionText === imageEmbedContainer.getAttribute('src')) {
                captionText = ''
              }
              if (!img) return
              const figure = imageEmbedContainer.querySelector('figure')
              const figCaption = imageEmbedContainer.querySelector('figcaption')
              if (figure) {
                // Node has already been processed
                // Check if the text needs to be updated
                if (figCaption && captionText) {
                  // Update the text in the existing element
                  figCaption.innerText = captionText
                } else if (!captionText) {
                  // The alt-text has been removed, so remove the custom <figure> element
                  // and set it back to how it was originally with just the plain <img> element
                  imageEmbedContainer.appendChild(img)
                  figure.remove()
                }
              } else {
                if (captionText && captionText !== imageEmbedContainer.getAttribute('src')) {
                  insertFigureWithCaption(img, imageEmbedContainer, captionText)
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
    this.observer.observe(document.body, {subtree: true, childList: true})
  }

  onunload () {
    this.observer.disconnect()
  }
}

/**
 * External images can be processed with a Markdown Post Processor, but only
 * in Reading View.
 */
function externalImageProcessor (): MarkdownPostProcessor {
  return (el) => {
    el.findAll('img')
      .forEach(img => {
        const captionText = img.getAttribute('alt')
        const parent = img.parentElement
        if (parent && captionText && captionText !== img.getAttribute('src')) {
          insertFigureWithCaption(img, parent, captionText)
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
 * @param imageEl
 * @param outerEl
 * @param captionText
 */
function insertFigureWithCaption (imageEl: HTMLElement, outerEl: HTMLElement | Element, captionText: string) {
  const figure = outerEl.createEl('figure')
  figure.addClass('image-captions-figure')
  figure.appendChild(imageEl)
  figure.createEl('figcaption', {
    text: captionText,
    cls: 'image-captions-caption'
  })
}
