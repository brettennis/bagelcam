<svelte:head>
	<script src="https://docs.opencv.org/3.4.0/opencv.js" on:load={init}></script>
</svelte:head>

<script>
    
import Slider from "./Slider.svelte";
import RadioOptions from "./RadioOptions.svelte";
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

// -----------------
// effect parameters
// -----------------

let ghost_A = false;
let ghost_fg = true;
let ghost_bg = false;
let ghost_capture = false;
function ghost_doCapture() {ghost_capture = true;}
let ghost_threshold = 30;
$: gThreshold = ghost_threshold * ghost_threshold;
let ghost_fg_hex = "#ffffff";
let ghost_bg_hex = "#000000";
$: ghost_fg_rgb = hextorgb(ghost_fg_hex);
$: ghost_bg_rgb = hextorgb(ghost_bg_hex);
let ghost_frame;
// let ghost_accum = new Queue();

let pixel_A = false;
let pixel_chunkSize = 3;
let pixel_corner = [];

let filter_A = false;
let filter_temp = 50;
let filter_saturate = 50;
let filter_bright = 50; 

let movey_A = false;
let movey_fg = true;
let movey_bg = false;
let movey_trail = false;
let movey_length = 10;
let movey_threshold = 40;
$: mThreshold = movey_threshold * movey_threshold;
let movey_fg_hex = "#ffffff";
let movey_bg_hex = "#000000";
$: movey_fg_rgb = hextorgb(movey_fg_hex);
$: movey_bg_rgb = hextorgb(movey_bg_hex);
let prev;
let movey_motion = Array(wt * ht).fill(0);

let poster_A = false;
let poster_threshold = 120;
let poster_maxvalue = 150;

// -----------------
// loadPreset
// 
// change all effect attributes based on json file
// -----------------

function loadPreset() {
    // translate string to json object
    try {
        const preset = JSON.parse(presetString);

        ghost_A = preset.ghost_A;
        ghost_fg = preset.ghost_fg;
        ghost_bg = preset.ghost_bg;
        ghost_capture = preset.ghost_capture;
        ghost_threshold = preset.ghost_threshold;
        ghost_fg_hex = preset.ghost_fg_hex;
        ghost_bg_hex = preset.ghost_bg_hex;

        pixel_A = preset.pixel_A;
        pixel_chunkSize = preset.pixel_chunkSize;

        filter_A = preset.filter_A;
        filter_temp = preset.filter_temp;
        filter_saturate = preset.filter_saturate;
        filter_bright = preset.filter_bright;

        movey_A = preset.movey_A;
        movey_fg = preset.movey_fg;
        movey_bg = preset.movey_bg;
        movey_trail = preset.movey_trail;
        movey_length = preset.movey_length;
        movey_threshold = preset.movey_threshold;
        movey_fg_hex = preset.movey_fg_hex;
        movey_bg_hex = preset.movey_bg_hex;

        poster_A = preset.poster_A;
        poster_threshold = preset.poster_threshold;
        poster_maxvalue = preset.poster_maxvalue;

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

    preset.ghost_A = ghost_A;
    preset.ghost_fg = ghost_fg;
    preset.ghost_bg = ghost_bg;
    preset.ghost_capture = ghost_capture;
    preset.ghost_threshold = ghost_threshold;
    preset.ghost_fg_hex = ghost_fg_hex;
    preset.ghost_bg_hex = ghost_bg_hex;

    preset.pixel_A = pixel_A;
    preset.pixel_chunkSize = pixel_chunkSize;

    preset.filter_A = filter_A;
    preset.filter_temp = filter_temp;
    preset.filter_saturate = filter_saturate;
    preset.filter_bright = filter_bright;

    preset.movey_A = movey_A;
    preset.movey_fg = movey_fg;
    preset.movey_bg = movey_bg;
    preset.movey_trail = movey_trail;
    preset.movey_length = movey_length;
    preset.movey_threshold = movey_threshold;
    preset.movey_fg_hex = movey_fg_hex;
    preset.movey_bg_hex = movey_bg_hex;

    preset.poster_A = poster_A;
    preset.poster_threshold = poster_threshold;
    preset.poster_maxvalue = poster_maxvalue;

    let savedPresetString = JSON.stringify(preset);

    navigator.clipboard.writeText(savedPresetString);
}

// -----------------
// init
// 
// initialize webcam
// -----------------

const init = async () => {

    // try {
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

        if (ghost_A) {
            if ( (distSq(r,g,b,
                    ghost_frame.data[i * 4 + 0], 
                    ghost_frame.data[i * 4 + 1],
                    ghost_frame.data[i * 4 + 2]) > gThreshold)) {

                if (ghost_fg) {
                    r = ghost_fg_rgb.r;
                    g = ghost_fg_rgb.g;
                    b = ghost_fg_rgb.b;
                }
            }
            else if (ghost_bg){
                r = ghost_bg_rgb.r;
                g = ghost_bg_rgb.g;
                b = ghost_bg_rgb.b;
            }
        }

        if (movey_A) {

            if (movey_motion[i * 4 + 0] > 0) {
                if (movey_fg) {
                    r = movey_fg_rgb.r;
                    g = movey_fg_rgb.g;
                    b = movey_fg_rgb.b;
                }
            }
            else if ( (distSq(r,g,b,
                        prev.data[i * 4 + 0], 
                        prev.data[i * 4 + 1],
                        prev.data[i * 4 + 2]) > mThreshold)) {

                if (movey_fg) {
                    r = movey_fg_rgb.r;
                    g = movey_fg_rgb.g;
                    b = movey_fg_rgb.b;
                }
                if (movey_trail)
                    movey_motion[i * 4 + 0] = movey_length;
            }
            else if (movey_bg) {
                r = movey_bg_rgb.r;
                g = movey_bg_rgb.g;
                b = movey_bg_rgb.b;
            }

            // decrement current pixel in motion array
            movey_motion[i * 4 + 0]--;
        }
        
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

        frame.data[i * 4 + 0] = r;
        frame.data[i * 4 + 1] = g;
        frame.data[i * 4 + 2] = b;
    }

    if (movey_A) prev = v_temp_ctx.getImageData(0, 0, wt, ht);

    if (ghost_capture) {
        ghost_frame = v_temp_ctx.getImageData(0, 0, wt, ht);
        ghost_capture = false;
    }

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
                <!-- <button class="button1-1" on:click={doPopout}>Popout</button> -->
                <button class="button1-2" on:click={doTrade}>Bypass</button>
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
            <div class="ghost-container-1">
                <button class="button3" on:click={ghost_doCapture}>capture</button>
                <p>move out of frame, click capture, then reenter frame</p>
            </div>

            <div class="divider"></div>

            <div class="ghost-container">
                <Toggle
                    id="fg"
                    showID={true}
                    bind:opt={ghost_fg}/>
                <div class="color-container">
                    <input
                        bind:value={ghost_fg_hex}
                        type="color">
                </div>
                <Toggle
                    id="bg"
                    showID={true}
                    bind:opt={ghost_bg}/>
                <div class="color-container">
                    <input
                        bind:value={ghost_bg_hex}
                        type="color">
                </div>
            </div>
            <Slider 
                bind:sliderValue={ghost_threshold}
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
        <input class="effect-toggle" bind:checked={movey_A} 
            type="checkbox"     id="tgl-movey">
        <label class="tgl-btn" for="tgl-movey"
            data-tg-off="movey" data-tg-on="movey!"></label>
        <div class="effect-inner">
            <Slider 
                bind:sliderValue={movey_length}
                id="eff-movey-length"
                label="length"
                minval={1}
                maxval={60}
                defval={10}/>
            <Toggle
                id="trail"
                showID={true}
                bind:opt={movey_trail}/>

            <div class="divider"></div>
            
            <div class="movey-container">
                <Toggle
                    id="fg"
                    showID={true}
                    bind:opt={movey_fg}/>
                <div class="color-container">
                    <input
                        bind:value={movey_fg_hex}
                        type="color">
                </div>
                <Toggle
                    id="bg"
                    showID={true}
                    bind:opt={movey_bg}/>
                <div class="color-container">
                    <input
                        bind:value={movey_bg_hex}
                        type="color">
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