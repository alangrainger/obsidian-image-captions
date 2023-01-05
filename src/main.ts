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
                  // Replace the original <img> element with this structure:
                  /*
                  <figure>
                    <img>
                    <figcaption>The caption text</figcaption>
                  </figure>
                  */
                  const figure = imageEmbedContainer.createEl('figure')
                  figure.addClass('image-captions-figure')
                  figure.appendChild(img)
                  figure.createEl('figcaption', {
                    text: captionText,
                    cls: 'image-captions-caption'
                  })
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
