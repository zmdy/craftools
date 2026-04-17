import { Craftools_Setup } from "./components/Setup.js";
import { Craftools_Editor } from "./components/Editor.js";
import { Craftools_Settings } from "./settings/Settings.js";
import { I18n } from "./settings/Translations.js";

export class Craftools{
    // Constructor
    constructor(wrapper){
        I18n.init();
        // Case the wrapper is a valid HTML element
        if( !this.setWrapper(wrapper) )
            return false;

        window.craftoolsApp = this;
        
        // Defines the components of the application
        this.components = [Craftools_Setup, Craftools_Editor];
        this.screen = Craftools_Setup; // setup, module_MODULENAME
        
        this.initComponents();
        this.renderComponent();

        // Listen to navigation events
        this.wrapper.addEventListener('craftools-start', (e) => {
            this.activeMedia = e.detail.media;
            this.activeSize = e.detail.size;
            window.craftoolsSize = e.detail.size;
            this.screen = Craftools_Editor;
            this.renderComponent();
        });
    }

    // Sets the wrapper and checks if it's valid
    setWrapper(wrapper){
        try {
            wrapper = wrapper instanceof HTMLElement ? wrapper : document.querySelector(wrapper);
            if(wrapper) this.wrapper = wrapper;
            return this.wrapper;
        } catch (error) {
            this.wrapper = false;
            console.error(`The term "${wrapper}" is not a valid HTML Element or selector.`)
            console.error(error);
        }
    }

    // Sets the wrapper content - or clears it
    setWrapperContent(content){
        this.wrapper.innerHTML = ""; 

        if (content instanceof HTMLElement) {
            this.wrapper.appendChild(content);
        } else {
            this.wrapper.innerHTML = content;
        }
    }

    // Initializes the components
    initComponents(){
        this.components.forEach(component => {
            component.init();
        });
    }

    // Run the this.action component
    renderComponent(){
        console.log(this.screen.name)
        let component_name = this.screen.name.toLowerCase().replace('_', '-');
        let component = document.createElement(component_name);

        this.setWrapperContent(component);
    }
}