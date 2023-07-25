<script>
    export let id;
    export let variation = 1;
    export let label;
	export let minval;
	export let maxval;
	export let defval;
    export let sliderValue = defval;
    let displayValue = label;

    id += 0; // gets rid of warning

    const handleInput = (e) => {
        sliderValue = e.target.value;
        doDisplayLabel();
    }

    const doDisplayValue = () => {displayValue = sliderValue;}
    const doDisplayLabel = () => {displayValue = label;}
</script>

<div class="backdrop{variation}">
    <input type="range" class="slider{variation}"
        on:input={doDisplayValue}
        on:mouseout={doDisplayLabel}
        on:blur={()=>{}}
		bind:value={sliderValue}
		min={minval} 
		max={maxval}>

	<input type="text" class="param_val{variation}"
        on:focus={doDisplayValue}
		on:blur={handleInput}
		value={displayValue}> 
</div>

<style>

.backdrop1 {
    /* background: purple; */
    width: 7rem;
    height: 17rem;
    margin: 0;
    padding: 0;
    display: flex;
    flex-flow: column nowrap;
    justify-content: center;
    align-items: center;
    position: relative;
}

.param_val1 {
    -webkit-appearance: none;
    appearance: none;
    background: var(--white);
    color: var(--black);
    border-radius: .5rem;
    border-width: 0px;
    width: 6rem;
    height: 1.5rem;
    text-align: center;
    position: relative;
    top: 6rem;
}

.slider1 {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    transform: rotate(-90deg);
    width: 13rem;	/* height */
    height: 1.5rem;	/* width  */
    /* border-style: solid;
    border-width: 1px; */
    position: relative;
    bottom: .6rem;
}

.slider1::-webkit-slider-runnable-track {
    -webkit-appearance: none;
    appearance: none;
    background: url("/icons/slider1_track.svg");
    background-repeat: no-repeat; 
    background-position: center;
    height: 1.5rem;	/* width  */
}

.slider1::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    margin-top: -1.8rem;
    margin-left: -.08rem;
    background: url("/icons/slider1_thumb.svg");
    background-repeat: no-repeat; 
    background-position: center; 
    cursor: pointer;
    height: 5rem; 	/* width  */
    width: 2.5rem;	/* height */
    transition: transform 0.2s;
}
.slider1::-webkit-slider-thumb:hover {
    transform: scale(1.06);
}

.backdrop2 {
    /* background: blueviolet; */
    width: 5rem;
    height: 12rem;
    margin: 0;
    padding: 0;
    display: flex;
    flex-flow: column nowrap;
    justify-content: center;
    align-items: center;
    position: relative;
}

.param_val2 {
    -webkit-appearance: none;
    appearance: none;
    background: var(--white);
    color: var(--black);
    border-radius: .5rem;
    border-width: 0px;
    width: 5rem;
    height: 1.5rem;
    text-align: center;
    position: relative;
    top: 5rem;
}

.slider2 {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    transform: rotate(-90deg);
    width: 10rem;	/* height */
    height: 1.5rem;	/* width  */
    /* border-style: solid;
    border-width: 1px; */
    position: relative;
}

.slider2::-webkit-slider-runnable-track {
    -webkit-appearance: none;
    appearance: none;
    background: url("/icons/slider2_track.svg");
    background-repeat: no-repeat; 
    background-position: center;
    height: 1.5rem;	/* width  */
}

.slider2::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    margin-top: -1rem;
    margin-left: -.08rem;
    background: url("/icons/slider2_thumb.svg");
    background-repeat: no-repeat; 
    background-position: center; 
    cursor: pointer;
    height: 3.4rem; /* width  */
    width: 2.5rem;	/* height */
}

</style>