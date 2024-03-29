<svelte:head>
	<script src="https://docs.opencv.org/3.4.0/opencv.js" on:load={init}></script>
</svelte:head>

<script>
    
import Slider from "./Slider.svelte";
import Toggle from "./Toggle.svelte";

export let presetString;
$: presetString && loadPreset();
export let presetSaving;
$: presetSaving && savePreset();

const wt = 320*1.2;
const ht = 240*1.2;

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
let ocv_mask;
let ocv_fgbg;
let frame;

let loading = false;
let streaming = false;

// changed by trade button, defaults to show output
let viewport_showInput = false;

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
// Queue
// 
// FIFO queue for use in ghost effect (unused)
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

// -----------------
// effect parameters
// -----------------

let params_ghost = {
    active: false,
    fg: true,
    bg: false,
    capture: false,
    threshold: 30,
    fg_hex: "#ffffff",
    bg_hex: "#000000"
}
function ghost_doCapture() {params_ghost.capture = true;}
$: ghost_threshold = params_ghost.threshold * params_ghost.threshold;
$: ghost_fg_rgb = hextorgb(params_ghost.fg_hex);
$: ghost_bg_rgb = hextorgb(params_ghost.bg_hex);
let ghost_frame;

let params_pixel = {
    active: false,
    chunkSize: 3,
    corner: []
}

let params_filter = {
    active: false,
    temp: 50,
    saturate: 50,
    bright: 50
}

let params_movey = {
    active: false,
    fg: true,
    bg: false,
    trail: false,
    length: 10,
    threshold: 40,
    fg_hex: "#ffffff",
    bg_hex: "#000000",
    motion: null
}
params_movey.motion = Array(wt * ht).fill(0);
$: movey_threshold = params_movey.threshold * params_movey.threshold;
$: movey_fg_rgb = hextorgb(params_movey.fg_hex);
$: movey_bg_rgb = hextorgb(params_movey.bg_hex);
let prev;

let params_poster = {
    active: false,
    threshold: 120,
    maxvalue: 150
}

// -----------------
// loadPreset
// 
// change all effect attributes based on json file
// -----------------

function loadPreset() {
    // translate string to json object
    try {
        const preset = JSON.parse(presetString);

        params_ghost.active = preset.ghost_A;
        params_ghost.fg = preset.ghost_fg;
        params_ghost.bg = preset.ghost_bg;
        params_ghost.capture = preset.ghost_capture;
        params_ghost.threshold = preset.ghost_threshold;
        params_ghost.fg_hex = preset.ghost_fg_hex;
        params_ghost.bg_hex = preset.ghost_bg_hex;

        params_pixel.active = preset.pixel_A;
        params_pixel.chunkSize = preset.pixel_chunkSize;

        params_filter.active = preset.filter_A;
        params_filter.temp = preset.filter_temp;
        params_filter.saturate = preset.filter_saturate;
        params_filter.bright = preset.filter_bright;

        params_movey.active = preset.movey_A;
        params_movey.fg = preset.movey_fg;
        params_movey.bg = preset.movey_bg;
        params_movey.trail = preset.movey_trail;
        params_movey.length = preset.movey_length;
        params_movey.threshold = preset.movey_threshold;
        params_movey.fg_hex = preset.movey_fg_hex;
        params_movey.bg_hex = preset.movey_bg_hex;

        params_poster.active = preset.poster_A;
        params_poster.threshold = preset.poster_threshold;
        params_poster.maxvalue = preset.poster_maxvalue;

    } catch (e) {
        alert("Hey! That preset is of the wrong format. Try again.");
    }
}

// -----------------
// savePreset
// 
// parse all effect attributes into json string
// -----------------

function savePreset() {

    let preset = {};

    preset.ghost_A = params_ghost.active;
    preset.ghost_fg = params_ghost.fg;
    preset.ghost_bg = params_ghost.bg;
    preset.ghost_capture = params_ghost.capture;
    preset.ghost_threshold = params_ghost.threshold;
    preset.ghost_fg_hex = params_ghost.fg_hex;
    preset.ghost_bg_hex = params_ghost.bg_hex;

    preset.pixel_A = params_pixel.active;
    preset.pixel_chunkSize = params_pixel.chunkSize;

    preset.filter_A = params_filter.active;
    preset.filter_temp = params_filter.temp;
    preset.filter_saturate = params_filter.saturate;
    preset.filter_bright = params_filter.bright;

    preset.movey_A = params_movey.active;
    preset.movey_fg = params_movey.fg;
    preset.movey_bg = params_movey.bg;
    preset.movey_trail = params_movey.trail;
    preset.movey_length = params_movey.length;
    preset.movey_threshold = params_movey.threshold;
    preset.movey_fg_hex = params_movey.fg_hex;
    preset.movey_bg_hex = params_movey.bg_hex;

    preset.poster_A = params_poster.active;
    preset.poster_threshold = params_poster.threshold;
    preset.poster_maxvalue = params_poster.maxvalue;

    let savedPresetString = JSON.stringify(preset);

    navigator.clipboard.writeText(savedPresetString);
}

// -----------------
// init
// 
// initialize webcam
// -----------------

const init = async () => {

    try {
        v_out_ctx       = v_out.getContext('2d');
        v_out_ctx_ocv   = v_out.getContext('2d');
        v_temp_ctx      = v_temp.getContext('2d', {willReadFrequently: true});
        ocv_mat_src     = new cv.Mat(ht, wt, cv.CV_8UC4);
        ocv_mat_tmp1    = new cv.Mat(ht, wt, cv.CV_8UC1);
        ocv_mat_dst     = new cv.Mat(ht, wt, cv.CV_8UC1);
        ocv_mask = new cv.Mat(ht, wt, cv.CV_8UC1);
        ocv_fgbg = new cv.BackgroundSubtractorMOG2(500, 16, false);
        streaming = true;
        loading = true;
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true, audio: false
        });
        v_in.srcObject = stream;
        v_in.play();
        loading = false;

        frame       = v_temp_ctx.getImageData(0, 0, wt, ht);
        prev        = v_temp_ctx.getImageData(0, 0, wt, ht);
        ghost_frame = v_temp_ctx.getImageData(0, 0, wt, ht);

        v_in.addEventListener("play", computeFrame);
    } catch (error) {
        alert("An error occurred!\n" + error);
    }
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

    if (params_pixel.active) {
        // for each row
        for (let y = 0; y < ht; y += params_pixel.chunkSize){
            // for each col
            for (let x = 0; x < wt; x += params_pixel.chunkSize) {
                params_pixel.corner = v_temp_ctx.getImageData(x,y,1,1).data;
                v_temp_ctx.fillStyle = "rgb("+params_pixel.corner[0]+","+params_pixel.corner[1]+","+params_pixel.corner[2]+")";
                v_temp_ctx.fillRect(x,y,params_pixel.chunkSize,params_pixel.chunkSize);
            }
        }
    }

    frame = v_temp_ctx.getImageData(0, 0, wt, ht);

    for (let i = 0; i < frame.data.length/4; i++) {

        let r = frame.data[i * 4 + 0];
        let g = frame.data[i * 4 + 1];
        let b = frame.data[i * 4 + 2];

        if (params_ghost.active) {
            if ( (distSq(r,g,b,
                    ghost_frame.data[i * 4 + 0], 
                    ghost_frame.data[i * 4 + 1],
                    ghost_frame.data[i * 4 + 2]) > ghost_threshold)) {

                if (params_ghost.fg) {
                    r = ghost_fg_rgb.r;
                    g = ghost_fg_rgb.g;
                    b = ghost_fg_rgb.b;
                }
            }
            else if (params_ghost.bg){
                r = ghost_bg_rgb.r;
                g = ghost_bg_rgb.g;
                b = ghost_bg_rgb.b;
            }
        }

        if (params_movey.active) {
            if (params_movey.motion[i * 4 + 0] > 0) {
                if (params_movey.fg) {
                    r = movey_fg_rgb.r;
                    g = movey_fg_rgb.g;
                    b = movey_fg_rgb.b;
                }
            }
            else if ( (distSq(r,g,b,
                        prev.data[i * 4 + 0], 
                        prev.data[i * 4 + 1],
                        prev.data[i * 4 + 2]) > movey_threshold)) {

                if (params_movey.fg) {
                    r = movey_fg_rgb.r;
                    g = movey_fg_rgb.g;
                    b = movey_fg_rgb.b;
                }
                if (params_movey.trail)
                    params_movey.motion[i * 4 + 0] = params_movey.length;
            }
            else if (params_movey.bg) {
                r = movey_bg_rgb.r;
                g = movey_bg_rgb.g;
                b = movey_bg_rgb.b;
            }

            // decrement current pixel in motion array
            params_movey.motion[i * 4 + 0]--;
        }
        
        if (params_filter.active) {

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

            let temp_amt = params_filter.temp - 50;
            if (temp_amt > 0) r += temp_amt;
            else              b += temp_amt;

            let saturate_amt = params_filter.saturate - 50;
            if      (r == max) r += saturate_amt;
            else if (g == max) g += saturate_amt;
            else if (b == max) b += saturate_amt;
            if      (r == min) r -= saturate_amt;
            else if (g == min) g -= saturate_amt;
            else if (b == min) b -= saturate_amt;

            let bright_amt = params_filter.bright - 50;
            r += bright_amt;
            g += bright_amt;
            b += bright_amt;

        }

        frame.data[i * 4 + 0] = r;
        frame.data[i * 4 + 1] = g;
        frame.data[i * 4 + 2] = b;
    }

    if (params_movey.active) prev = v_temp_ctx.getImageData(0, 0, wt, ht);

    if (params_ghost.capture) {
        ghost_frame = v_temp_ctx.getImageData(0, 0, wt, ht);
        params_ghost.capture = false;
    }

    v_out_ctx.putImageData(frame, 0, 0);

    // #endregion

    ocv_mat_src.data.set(v_out_ctx_ocv.getImageData(0, 0, wt, ht).data);
    if (params_poster.active) {
        cv.threshold(ocv_mat_src, ocv_mat_dst, params_poster.threshold, params_poster.maxvalue, cv.THRESH_BINARY);
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

        <!-- svelte-ignore a11y-media-has-caption -->
        <video  
            bind:this={v_in}  id="v_in"  
            width={wt} height={ht}
            style="{viewport_showInput ? "display:block" : "display:none"}"/>
        
        <canvas 
            bind:this={v_out} id="v_out" 
            width={wt} height={ht}
            style="{viewport_showInput ? "display:none" : "display:block"}"/>

        {#if params_poster.active}
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
                <!-- <button class="button1-1" on:click={doPopout}>Popout</button> -->
                <button class="button1-2" on:click={doTrade}>Bypass</button>
            </div>

            {#if streaming}
            <p class="fps">FPS: {fps}</p>
            {/if}

        </div>
    </div>

    <div class="effect" id="eff-filter" style="grid-area: 2 / 1 / 3 / 3">
        <input class="effect-toggle" bind:checked={params_filter.active} 
            type="checkbox"     id="tgl-filter">
        <label class="tgl-btn" for="tgl-filter"
            data-tg-off="filter" data-tg-on="filter!"></label>
        <div class="effect-inner">
            <Slider 
                bind:sliderValue={params_filter.temp}
                id="eff-filter-temp"
                label="temp"
                minval={0}
                maxval={100}
                defval={50}/>
            <Slider 
                bind:sliderValue={params_filter.saturate}
                id="eff-filter-saturate"
                label="saturate"
                minval={0}
                maxval={100}
                defval={50}/>
            <Slider 
                bind:sliderValue={params_filter.bright}
                id="eff-filter-bright"
                label="bright"
                minval={0}
                maxval={100}
                defval={50}/>
        </div>
    </div>

    <div class="effect" id="eff-ghost" style="grid-area: 1 / 3 / 2 / 5">
        <input class="effect-toggle" bind:checked={params_ghost.active} 
            type="checkbox"     id="tgl-ghost">
        <label class="tgl-btn" for="tgl-ghost"
            data-tg-off="ghost" data-tg-on="ghost!"></label>
        <div class="effect-inner">
            <div class="ghost-container-1">
                <button class="button3" on:click={ghost_doCapture}>capture</button>
                <p>move out of frame, click capture, then reenter frame</p>
            </div>

            <div class="divider"></div>

            <div class="ghost-container">
                <Toggle
                    id="fg"
                    showID={true}
                    bind:opt={params_ghost.fg}/>
                <div class="color-container">
                    <input
                        bind:value={params_ghost.fg_hex}
                        type="color">
                </div>
                <Toggle
                    id="bg"
                    showID={true}
                    bind:opt={params_ghost.bg}/>
                <div class="color-container">
                    <input
                        bind:value={params_ghost.bg_hex}
                        type="color">
                </div>
            </div>
            <Slider 
                bind:sliderValue={params_ghost.threshold}
                id="eff-ghost-threshold"
                label="threshold"
                minval={10}
                maxval={120}
                defval={30}/>
            <!-- <Slider 
                bind:sliderValue={ghost_amount}
                id="eff-ghost-amount"
                label="amount"
                minval={0}
                maxval={30}
                defval={1}/>
            <Slider 
                bind:sliderValue={ghost_delay}
                id="eff-ghost-delay"
                label="delay"
                minval={0}
                maxval={30}
                defval={1}/> -->
        </div>
    </div>

    <div class="effect" id="eff-movey" style="grid-area: 2 / 3 / 3 / 5">
        <input class="effect-toggle" bind:checked={params_movey.active} 
            type="checkbox"     id="tgl-movey">
        <label class="tgl-btn" for="tgl-movey"
            data-tg-off="movey" data-tg-on="movey!"></label>
        <div class="effect-inner">
            <Slider 
                bind:sliderValue={params_movey.length}
                id="eff-movey-length"
                label="length"
                minval={1}
                maxval={60}
                defval={10}/>
            <Toggle
                id="trail"
                showID={true}
                bind:opt={params_movey.trail}/>

            <div class="divider"></div>
            
            <div class="movey-container">
                <Toggle
                    id="fg"
                    showID={true}
                    bind:opt={params_movey.fg}/>
                <div class="color-container">
                    <input
                        bind:value={params_movey.fg_hex}
                        type="color">
                </div>
                <Toggle
                    id="bg"
                    showID={true}
                    bind:opt={params_movey.bg}/>
                <div class="color-container">
                    <input
                        bind:value={params_movey.bg_hex}
                        type="color">
                </div>
            </div>
            <Slider 
                bind:sliderValue={params_movey.threshold}
                id="eff-movey-threshold"
                label="threshold"
                minval={10}
                maxval={120}
                defval={40}/>
        </div>
    </div>

    <div class="effect" id="eff-pixel" style="grid-area: 1 / 5 / 2 / 6">
        <input class="effect-toggle" bind:checked={params_pixel.active} 
            type="checkbox"     id="tgl-pixel">
        <label class="tgl-btn" for="tgl-pixel"
            data-tg-off="pixel" data-tg-on="pixel!"></label>
        <div class="effect-inner">
            <Slider 
                bind:sliderValue={params_pixel.chunkSize}
                id="eff-pixel-resolution"
                label="resolution"
                minval={3}
                maxval={20}
                defval={3}/>
        </div>
    </div>

    <div class="effect" id="eff-poster" style="grid-area: 2 / 5 / 3 / 6">
        <input class="effect-toggle" bind:checked={params_poster.active} 
            type="checkbox"     id="tgl-poster">
        <label class="tgl-btn" for="tgl-poster"
            data-tg-off="poster" data-tg-on="poster!"></label>
        <div class="effect-inner">
            <Slider 
                bind:sliderValue={params_poster.threshold}
                id="eff-poster-threshold"
                label="threshold"
                minval={30}
                maxval={250}
                defval={120}/>
            <Slider 
                bind:sliderValue={params_poster.maxvalue}
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
    align-items: flex-start;
    padding: 0;
    margin: 0;
}

.divider {
    height: 85%; 
    width: .7rem; 
    margin: 1.5rem; 
    background: var(--bagel-yellow-light);
    border-radius: .7rem;
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
.tgl-btn:hover {
    transform: scale(1.05);
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

.ghost-container-1 {
    width: 10rem;
    display: flex;
    flex-direction: column;
    height: 100%;
    align-items: center;
    margin-left: 1.5rem;
    text-align: center;
}
.ghost-container {
    /* background-color: aqua; */
    display: flex;
    flex-direction: column;
    height: 100%;
    justify-content: flex-start;
    align-items: center;
}
.movey-container {
    /* background-color: aqua; */
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
    margin-top: 2rem;
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
