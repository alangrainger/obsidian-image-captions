import { Plugin } from 'obsidian'

export default class ImageCaptions extends Plugin {
  observer: MutationObserver

  async onload () {
    this.observer = new MutationObserver((mutations: MutationRecord[]) => {
      mutations.forEach((rec: MutationRecord) => {
        if (rec.type === 'childList') {
          (<Element>rec.target)
            // Search for all .image-embed nodes. Could be <div> or <span>
            .querySelectorAll('.image-embed')
            .forEach(container => {
              const img = container.querySelector('img')
              let captionText = container.getAttribute('alt') || ''
              const width = container.getAttribute('width') || ''
              if (captionText === container.getAttribute('src')) {
                captionText = ''
              }
              if (!img) return
              const figure = container.querySelector('figure')
              if (figure) {
                // Node has already been processed
                // Check if the text needs to be updated
                if (!captionText) {
                  // Caption has been removed, so remove the custom element
                  container.appendChild(img)
                  figure.remove()
                } else {
                  // Update the text in the existing element
                  const figCaption = container.querySelector('figcaption')
                  if (figCaption) {
                    figCaption.innerText = captionText
                  }
                }
              } else {
                if (img && captionText && captionText !== container.getAttribute('src')) {
                  const figure = container.createEl('figure')
                  figure.addClass('image-captions-figure')
                  figure.appendChild(img)
                  figure.createEl('figcaption', {
                    text: captionText,
                    cls: 'image-captions-caption'
                  })
                }
              }
              // Update the image width, if specified
              if (width) {
                img.setAttribute('width', width)
              } else {
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
