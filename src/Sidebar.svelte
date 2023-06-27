<script>
    import { createEventDispatcher } from 'svelte'

    const dispatch = createEventDispatcher()

    export let presetString = "";
    export let presetSaving = false;

    let inputObject;
    let inputString = " paste preset here"
    let defaultConsole = "click save to copy preset to clipboard";
    let presetConsole = defaultConsole;

    function doLoad() {
        if (inputString[0] == '{') {
            presetString = inputString;
            presetConsole = "loaded from text input!";
            setTimeout(() => { 
                presetConsole = defaultConsole;
            }, "3000");
        } else {
            presetConsole = "sorry, invalid format!";
            setTimeout(() => { 
                presetConsole = defaultConsole;
            }, "3000");
        }
    }

    function doSave() {
        presetSaving = true;
        presetConsole = "copied to clipboard!";
        setTimeout(() => { 
            presetSaving = false; 
            presetConsole = defaultConsole;
        }, "3000");
    }

</script>

<div class="backdrop">

    <img class="logo" alt="" src="images/bagel_long.PNG" width="200px"/>
    
    <div class="presets-container">
        <input class="preset-input" type="text" 
            bind:value={inputString} 
            bind:this={inputObject}
            on:focus={() => { inputObject.select(); } }>
        <button class="buttonSave" on:click={doSave}>save</button>
        <button class="buttonSave" on:click={doLoad}>load</button>
        <p class="preset-console">{presetConsole}</p>
    </div>

    <button class="button-preset" on:click={()=>{
        let mypreset = {"ghost_A":false,"ghost_fg":true,"ghost_bg":false,"ghost_capture":false,"ghost_threshold":30,"ghost_fg_hex":"#ffffff","ghost_bg_hex":"#000000","pixel_A":true,"pixel_chunkSize":6,"filter_A":true,"filter_temp":51,"filter_saturate":63,"filter_bright":58,"movey_A":false,"movey_fg":true,"movey_bg":false,"movey_trail":false,"movey_length":10,"movey_threshold":40,"movey_fg_hex":"#ffffff","movey_bg_hex":"#000000","poster_A":true,"poster_threshold":143,"poster_maxvalue":100};
        inputString = JSON.stringify(mypreset);
        doLoad(); 
    }}>sprite</button>

    <button class="button-preset" on:click={()=>{
        let mypreset = {"ghost_A":false,"ghost_fg":true,"ghost_bg":false,"ghost_capture":false,"ghost_threshold":30,"ghost_fg_hex":"#ffffff","ghost_bg_hex":"#000000","pixel_A":false,"pixel_chunkSize":3,"filter_A":false,"filter_temp":50,"filter_saturate":50,"filter_bright":50,"movey_A":true,"movey_fg":true,"movey_bg":true,"movey_trail":true,"movey_length":10,"movey_threshold":40,"movey_fg_hex":"#af65ec","movey_bg_hex":"#d8d2da","poster_A":false,"poster_threshold":120,"poster_maxvalue":150};
        inputString = JSON.stringify(mypreset);
        doLoad(); 
    }}>purple haze</button>

    <button class="button-preset" on:click={()=>{ 
        let mypreset = {"ghost_A":true,"ghost_fg":false,"ghost_bg":true,"ghost_capture":false,"ghost_threshold":43,"ghost_fg_hex":"#ffffff","ghost_bg_hex":"#610000","pixel_A":false,"pixel_chunkSize":10,"filter_A":true,"filter_temp":36,"filter_saturate":67,"filter_bright":32,"movey_A":false,"movey_fg":false,"movey_bg":false,"movey_trail":false,"movey_length":10,"movey_threshold":40,"movey_fg_hex":"#ffffff","movey_bg_hex":"#000000","poster_A":true,"poster_threshold":112,"poster_maxvalue":93};
        inputString = JSON.stringify(mypreset);
        doLoad(); 
    }}>the void</button>


    <!-- 
    <div class="modulation">

        <div class="mod-container">
            <div class="mod-item-left">
                <h1>mod</h1>
                <Slider 
                    bind:sliderValue={mod_intensity}
                    id="mod-intensity"
                    variation="2"
                    label="intensity"
                    minval={0}
                    maxval={100}
                    defval={0}/>
            </div>
            <div class="mod-item-right">
                <div style="height: 1.5rem;"></div>
                <Slider 
                    bind:sliderValue={mod_wobbler}
                    id="mod-wobbler"
                    variation="2"
                    label="wobbler"
                    minval={0}
                    maxval={100}
                    defval={50}/>
            </div>
        </div>

        <div class="mod-source">
            <RadioOptions 
                bind:optionChosen={mod_source}
                id="mod source"
                opt1="Audio Highs"
                opt2="Audio Lows"
                opt3="Movement"
                opt4="Wobbler"/>
        </div>
        
    </div> -->

</div>

<style>

.backdrop {
    background-image: linear-gradient(to top, var(--header-brown) 90%, var(--header-brown-dark));
    color: var(--white);
    width: 15rem;
    height: 100vh;
    padding: 1.5rem;
    margin: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    text-align: center;
}

.logo {
    margin-bottom: 2rem;
}

.button-preset {
    background-color: var(--bagel-yellow-light);
    width: 8rem;
    height: 5rem;
    margin-bottom: 2rem;
    border: 0;
    border-radius: 1rem;
    cursor: pointer;
}

.preset-input {
    font-family: 'Courier New', Courier, monospace !important;
    width: 90%;
    height: 1.6rem;
    background-color: var(--white);
    color: var(--black);
    border: 0;
    border-radius: 0.25rem;
    margin-bottom: 1rem;
}

.preset-console {
    height: 5rem;
}

</style>