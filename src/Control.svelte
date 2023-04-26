<svelte:head>
	<script src="https://docs.opencv.org/3.4.0/opencv.js" on:load={init}></script>
</svelte:head>

<script>
    
import Slider from "./Slider.svelte";
import RadioOptions from "./RadioOptions.svelte";
import Toggle from "./Toggle.svelte";

const wt = 320;
const ht = 240;

let fps = 30;
let delay = 0;
let iter = 0;

let v_in;
let v_out = null;
let v_out_ocv = null;
let v_out_ctx;
let v_out_ctx_ocv;
let v_temp = null;
let v_temp_ctx;
let ocv_mat_src;
let ocv_mat_tmp1;
let ocv_mat_dst;
let frame;

let loading = false;
let streaming = false;

// changed by trade button, defaults to show output
let viewport_showInput = false;

export let colorA_hex;
export let colorB_hex;
export let colorC_hex;
$: colorA_rgb = hextorgb(colorA_hex);
$: colorB_rgb = hextorgb(colorB_hex);
$: colorC_rgb = hextorgb(colorC_hex);

// -----------------
// hextorgb
//
// compute rgb from hex returned by color pickers
// returns [r,g,b]
// -----------------

function hextorgb(hexval) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexval);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// -----------------
// effect parameters
// -----------------

let ghost_A = false;
let ghost_mode = 1;
let ghost_amount = 0;
let ghost_delay = 0;
let ghost_accum = [];

let pixel_A = false;
let pixel_chunkSize = 3;
let pixel_corner = [];

let filter_A = false;
let filter_temp = 50;
let filter_saturate = 50;
let filter_bright = 50; 

let chroma_A = false;
let chroma_threshold = 1;

let movey_A = false;
let movey_block = false;
let movey_threshold = 40;
$: mThreshold = movey_threshold * movey_threshold;
let prev;
let avg = 0;

let poster_A = false;
let poster_threshold = 120;
let poster_maxvalue = 150;

// -----------------
// Queue
// 
// FIFO queue for use in ghost effect
// -----------------

class Queue {
    constructor() {
        this.frames = {};
        this.front = 0;
        this.back = 0;
    }
    enqueue(frame) {
        this.frames[this.back] = frame;
        this.back++;
    }
    dequeue() {
        const frame = this.frames[this.front];
        delete this.frames[this.front];
        this.front++;
        return frame;
    }
}

let queue = new Queue()

// -----------------
// init
// 
// initialize webcam
// -----------------

const init = async () => {

    // try {
        v_out_ctx = v_out.getContext('2d');
        v_out_ctx_ocv = v_out.getContext('2d');
        v_temp_ctx = v_temp.getContext('2d', {willReadFrequently: true});
        ocv_mat_src = new cv.Mat(ht, wt, cv.CV_8UC4);
        ocv_mat_tmp1 = new cv.Mat(ht, wt, cv.CV_8UC1);
        ocv_mat_dst = new cv.Mat(ht, wt, cv.CV_8UC1);
        streaming = true;
        loading = true;
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true, audio: false
        });
        v_in.srcObject = stream;
        v_in.play();
        loading = false;

        frame = v_temp_ctx.getImageData(0, 0, wt, ht);
        prev = v_temp_ctx.getImageData(0, 0, wt, ht);

        v_in.addEventListener("play", computeFrame);
    // } catch (error) {
    //     alert("An error occurred!\n" + error);
    // }
};

// -----------------
// computeFrame
// 
// compute and display next frame 
// -----------------

function computeFrame() {
    if (!streaming) { ocv_mat_src.delete(); ocv_mat_tmp1.delete(); ocv_mat_dst.delete(); return; }
    let begin = Date.now();
    //#region

    v_temp_ctx.drawImage(v_in, 0, 0, wt, ht);

    if (pixel_A) {
        // for each row
        for (let y = 0; y < ht; y += pixel_chunkSize){
            // for each col
            for (let x = 0; x < wt; x += pixel_chunkSize) {
                pixel_corner = v_temp_ctx.getImageData(x,y,1,1).data;
                v_temp_ctx.fillStyle = "rgb("+pixel_corner[0]+","+pixel_corner[1]+","+pixel_corner[2]+")";
                v_temp_ctx.fillRect(x,y,pixel_chunkSize,pixel_chunkSize);
            }
        }
    }

    frame = v_temp_ctx.getImageData(0, 0, wt, ht);

    for (let i = 0; i < frame.data.length/4; i++) {

        let r = frame.data[i * 4 + 0];
        let g = frame.data[i * 4 + 1];
        let b = frame.data[i * 4 + 2];
        
        if (filter_A) {

            // find min and max values
            let min = r;
            let mid = g;
            let max = b;
            if (min > mid) { mid = r; min = g; }
            if (mid > max)
            {
                max = mid;
                mid = b;
                if (min > mid) min = b;
            }

            let temp_amt = filter_temp - 50;
            if (temp_amt > 0) r += temp_amt;
            else              b += temp_amt;

            let saturate_amt = filter_saturate - 50;
            if      (r == max) r += saturate_amt;
            else if (g == max) g += saturate_amt;
            else if (b == max) b += saturate_amt;
            if      (r == min) r -= saturate_amt;
            else if (g == min) g -= saturate_amt;
            else if (b == min) b -= saturate_amt;

            let bright_amt = filter_bright - 50;
            r += bright_amt;
            g += bright_amt;
            b += bright_amt;

        }

        if (movey_A) {
            if ( (distSq(r,g,b,
                        prev.data[i * 4 + 0], 
                        prev.data[i * 4 + 1],
                        prev.data[i * 4 + 2]) > mThreshold)) {
                
                r = colorA_rgb.r;
                g = colorA_rgb.g;
                b = colorA_rgb.b;
            }
            else if (movey_block) {
                r = colorB_rgb.r;
                g = colorB_rgb.g;
                b = colorB_rgb.b;
            }
        }

        frame.data[i * 4 + 0] = r;
        frame.data[i * 4 + 1] = g;
        frame.data[i * 4 + 2] = b;
    }

    if (movey_A) prev = v_temp_ctx.getImageData(0, 0, wt, ht);

    v_out_ctx.putImageData(frame, 0, 0);

    // #endregion

    ocv_mat_src.data.set(v_out_ctx_ocv.getImageData(0, 0, wt, ht).data);
    if (poster_A) {
        cv.threshold(ocv_mat_src, ocv_mat_dst, poster_threshold, poster_maxvalue, cv.THRESH_BINARY);
        cv.imshow("v_out_ocv", ocv_mat_dst);
    }

    delay = 1000/30 - (Date.now() - begin);
    if (iter > 3) {
        //update fps every 3 frames
        fps = parseInt(delay);
        iter = 0;
    } else iter++;
    setTimeout(computeFrame, delay);
}

function doPopout() {

}

function doTrade() {
    viewport_showInput = !viewport_showInput;
    // console.log(viewport_showInput);
}

// used for movey
function distSq(x1, y1, z1, x2, y2, z2) {
    return (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1) + (z2-z1)*(z2-z1)
}

</script>

<!--                                                                              JS -->
<!-- ------------------------------------------------------------------------------- -->
<!--                                                                            HTML -->

<div class="backdrop">

    <div class="viewport" style="grid-area: 1 / 1 / 2 / 3">
        {#if loading}
        <h3>loading...</h3>
        {/if}
        
        {#if !streaming}
        <button class="button2" on:click={init}>start</button>
        {/if}

        <!-- svelte-ignore a11y-media-has-caption -->
        <video  
            bind:this={v_in}  id="v_in"  
            width={wt} height={ht}
            style="{viewport_showInput ? "display:block" : "display:none"}"/>
        
        <canvas 
            bind:this={v_out} id="v_out" 
            width={wt} height={ht}
            style="{viewport_showInput ? "display:none" : "display:block"}"/>

        {#if poster_A}
        <canvas 
            bind:this={v_out_ocv} id="v_out_ocv" 
            width={wt} height={ht}
            style="{viewport_showInput ? "display:none" : "display:block"}"/>
        {/if}
        
        <canvas 
            bind:this={v_temp} 
            width={wt} height={ht} 
            style="display:none"/>

        <div class="controller">

            <div class="button-controller">
                <button class="button1-1" on:click={doPopout}>Popout</button>
                <button class="button1-2" on:click={doTrade}>Trade</button>
            </div>

            {#if streaming}
            <p class="fps">FPS: {fps}</p>
            {/if}

        </div>
    </div>

    <div class="effect" id="eff-filter" style="grid-area: 2 / 1 / 3 / 3">
        <input class="effect-toggle" bind:checked={filter_A} 
            type="checkbox"     id="tgl-filter">
        <label class="tgl-btn" for="tgl-filter"
            data-tg-off="filter" data-tg-on="filter!"></label>
        <div class="effect-inner">
            <Slider 
                bind:sliderValue={filter_temp}
                id="eff-filter-temp"
                label="temp"
                minval={0}
                maxval={100}
                defval={50}/>
            <Slider 
                bind:sliderValue={filter_saturate}
                id="eff-filter-saturate"
                label="saturate"
                minval={0}
                maxval={100}
                defval={50}/>
            <Slider 
                bind:sliderValue={filter_bright}
                id="eff-filter-bright"
                label="bright"
                minval={0}
                maxval={100}
                defval={50}/>
        </div>
    </div>

    <div class="effect" id="eff-ghost" style="grid-area: 1 / 3 / 2 / 5">
        <input class="effect-toggle" bind:checked={ghost_A} 
            type="checkbox"     id="tgl-ghost">
        <label class="tgl-btn" for="tgl-ghost"
            data-tg-off="ghost" data-tg-on="ghost!"></label>
        <div class="effect-inner">
            <RadioOptions 
                bind:optionChosen={ghost_mode}
                id="ghost mode"
                opt1="RedGreenBlue"
                opt2="Brighter"
                opt3="Darker"
                opt4="Solid"/>
            <Slider 
                bind:sliderValue={ghost_amount}
                id="eff-ghost-amount"
                label="amount"
                minval={0}
                maxval={100}
                defval={50}/>
            <Slider 
                bind:sliderValue={ghost_delay}
                id="eff-ghost-delay"
                label="delay"
                minval={0}
                maxval={100}
                defval={50}/>
        </div>
    </div>

    <div class="effect" id="eff-chroma" style="grid-area: 2 / 3 / 3 / 4">
        <input class="effect-toggle" bind:checked={chroma_A} 
            type="checkbox"     id="tgl-chroma">
        <label class="tgl-btn" for="tgl-chroma"
            data-tg-off="chroma" data-tg-on="chroma!"></label>
        <div class="effect-inner">
            <Slider 
                bind:sliderValue={chroma_threshold}
                id="eff-chroma-threshold"
                label="threshold"
                minval={0}
                maxval={100}
                defval={50}/>
        </div>
    </div>

    <div class="effect" id="eff-movey" style="grid-area: 2 / 4 / 3 / 5">
        <input class="effect-toggle" bind:checked={movey_A} 
            type="checkbox"     id="tgl-movey">
        <label class="tgl-btn" for="tgl-movey"
            data-tg-off="movey" data-tg-on="movey!"></label>
        <div class="effect-inner">
            <div class="movey-container">
                <Toggle
                    id="block"
                    bind:opt={movey_block}/>
                <div class="color-container">
                    <!-- <h3>a</h3> -->
                    <input
                        bind:value={colorA_hex}
                        type="color"
                        id="colorpickerA">
                </div>
                <div class="color-container">
                    <!-- <h3>b</h3> -->
                    <input
                        bind:value={colorB_hex}
                        type="color"
                        id="colorpickerA">
                </div>
            </div>
            <Slider 
                bind:sliderValue={movey_threshold}
                id="eff-movey-threshold"
                label="threshold"
                minval={10}
                maxval={120}
                defval={40}/>
        </div>
    </div>

    <div class="effect" id="eff-pixel" style="grid-area: 1 / 5 / 2 / 6">
        <input class="effect-toggle" bind:checked={pixel_A} 
            type="checkbox"     id="tgl-pixel">
        <label class="tgl-btn" for="tgl-pixel"
            data-tg-off="pixel" data-tg-on="pixel!"></label>
        <div class="effect-inner">
            <Slider 
                bind:sliderValue={pixel_chunkSize}
                id="eff-pixel-resolution"
                label="resolution"
                minval={3}
                maxval={20}
                defval={3}/>
        </div>
    </div>

    <div class="effect" id="eff-poster" style="grid-area: 2 / 5 / 3 / 6">
        <input class="effect-toggle" bind:checked={poster_A} 
            type="checkbox"     id="tgl-poster">
        <label class="tgl-btn" for="tgl-poster"
            data-tg-off="poster" data-tg-on="poster!"></label>
        <div class="effect-inner">
            <Slider 
                bind:sliderValue={poster_threshold}
                id="eff-poster-threshold"
                label="threshold"
                minval={30}
                maxval={250}
                defval={120}/>
            <Slider 
                bind:sliderValue={poster_maxvalue}
                id="eff-poster-maxvalue"
                label="opacity"
                minval={0}
                maxval={255}
                defval={150}/>
        </div>
    </div>

</div>

<!--                                                                            HTML -->
<!-- ------------------------------------------------------------------------------- -->
<!--                                                                             CSS -->

<style>

.backdrop {
    width: 100%;
    height: 100%;
    padding: 1rem;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(2, 1fr);
    grid-column-gap: 1rem;
    grid-row-gap: 1rem;
}

.viewport {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    width: 400px;
    height: 310px;
}

#v_out_ocv {
    position: absolute;
}

.effect {
    background-color: var(--bagel-yellow);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: .5rem;
    margin: 0;
    height: 22rem;
    border-radius: .75rem;
}

.effect-inner {
    /* background: aqua; */
    display: flex;
    justify-content: space-around;
    align-items: flex-start;
    padding: 0;
    margin: 0;
}





.effect-toggle + .tgl-btn {
    padding: 2px;
    transition: all 0.2s ease;
    font-family: sans-serif;
    font-size: 2rem;
    perspective: 400px;
    position: absolute;
    width: 10rem;
    height: 2rem;
    cursor: pointer;
}
.effect-toggle + .tgl-btn:after, .effect-toggle + .tgl-btn:before {
    display: inline-block;
    transition: all 0.4s ease;
    width: 100%;
    text-align: center;
    line-height: 2em;
    color: var(--bagel-red);
    position: absolute;
    top: 0;
    left: 0;
    -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
    border-radius: .5rem;
}
.effect-toggle + .tgl-btn:after {
    content: attr(data-tg-on);
    background: var(--white);
    transform: rotateY(-180deg);
}
.effect-toggle + .tgl-btn:before {
    background: var(--bagel-yellow-light);
    content: attr(data-tg-off);
}
.effect-toggle + .tgl-btn:active:before {
    transform: rotateY(-20deg);
}
.effect-toggle:checked + .tgl-btn:before {
    transform: rotateY(180deg);
}
.effect-toggle:checked + .tgl-btn:after {
    transform: rotateY(0);
    left: 0;
    background: var(--white);
}
.effect-toggle:checked + .tgl-btn:active:after {
    transform: rotateY(20deg);
}


.movey-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    justify-content: flex-start;
    align-items: center;
}
.color-container {
    color: var(--header-brown-dark);
    text-align: center;
    /* display: flex; */
    height: 2rem;
    width: 3rem;
    margin-bottom: 1rem;
}
input[type="color"] {
    width: 100%;
    height: 100%;
    padding: 0;
    background-color: var(--bagel-yellow-light);
}



.controller {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    width: 100%;
}

.button-controller {
    display: flex;
}

.fps {
    align-self: flex-start;
    color: var(--black);
    font-size: 1.3rem;
}

</style>