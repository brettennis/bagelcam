<script>
    import RadioOptions from "./RadioOptions.svelte";
    import Slider from "./Slider.svelte";

    export let colorA_hex = "#FFFFFF";
    export let colorB_hex = "#000000";
    export let colorC_hex = "#808080";
    
    let mod_source = 1;

    let mod_intensity = 0;
    let mod_wobbler = 50;

</script>

<div class="backdrop">
    
    <!-- <div class="presets" style="display: none">
        <h1>presets</h1>
        <button class="button2">save</button>
        <button class="button2">load</button>
    </div> -->

    <div class="mycolors">

        <h1>colors</h1>

        <div class="color-label-container">
            <h3>a</h3> <h3>b</h3> <h3>c</h3>
        </div>

        <div class="color-container">
            <input
                bind:value={colorA_hex}
                type="color"
                id="colorpickerA">
            <input 
                bind:value={colorB_hex}
                type="color"
                id="colorpickerB">
            <input 
                bind:value={colorC_hex}
                type="color"
                id="colorpickerC">
        </div>

    </div>

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
        
    </div>

</div>

<style>

.backdrop {
    /* background-color: var(--header-brown); */
    background-image: linear-gradient(to top, var(--header-brown) 90%, var(--header-brown-dark));
    color: var(--white);
    width: 15rem;
    height: 100vh;
    padding: .5rem;
    margin: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    text-align: center;
}

h1 {
    font-size: 1.7rem;
}

.color-label-container {
    /* background: aqua; */
    display: flex;
    height: 1.3rem;
    justify-content: space-around;
    align-items: center;
}

.color-container {
    display: flex;
    height: 2rem;
    width: 10rem;
    margin-bottom: 1rem;
}

input[type="color"] {
    width: 100%;
    height: 100%;
    padding: 0;
    background-color: var(--header-brown);
}

.mod-container {
    display: flex;
    /* background-color: blue; */
}

.mod-source {
    margin-top: 1.5rem;
}

</style>