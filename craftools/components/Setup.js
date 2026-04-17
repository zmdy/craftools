import {Craftools_Settings} from "../settings/Settings.js";

export class Craftools_Setup extends HTMLElement{
    constructor(){ super(); }
    
    connectedCallback(){
        // Media types
        let mediaTypes = "<ul>";

        for (const key in Craftools_Settings.mediaTypes) {
            const media = Craftools_Settings.mediaTypes[key];
            mediaTypes +=
            `<li><a href="#${key}">
                <h3>
                    <span class="material-symbols-outlined"> ${media.icon} </span>
                    ${media.name}
                </h3>
                <p>${media.description}</p>
                
            </a></li>`;
        }

        mediaTypes += "</ul>";

        this.innerHTML = `
        <div class="craftools-settings-media">
            <h2>O que você quer criar?</h2>
            ${mediaTypes}
        </div>

        <div class="craftools-settings-sizes">

        </div>
        `;
    }

    static init(){ customElements.define("craftools-setup", Craftools_Setup) }
}