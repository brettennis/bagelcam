<script>
    export let showModal = true;
    let tutorial_text_color;
</script>

{#if showModal}
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="backdrop">
    <div class="modal">
        <div class="welcome">
            <h1>Welcome to bagelcam.</h1>
            <h3>
                This app requires access to 
                your device's built-in webcam.
            </h3>
            <button class="button-start" on:click>I'm ready!</button>
        </div>
        <div class="left">
            <div class="left-container">
                <h3 style="width:13rem">
                    click an effect's name to enable it.
                </h3>
                <input class="effect-toggle" 
                    type="checkbox"     id="tgl-tut">
                <label class="tgl-btn" for="tgl-tut"
                    data-tg-off="disabled" data-tg-on="enabled!"></label>
            </div>
        </div>
        <div class="right">
            <div class="right-container">
                <input type="color" bind:value={tutorial_text_color}>
                <h3 style="color:{tutorial_text_color}">
                    use color pickers to choose your favorite color.
                </h3>
            </div>
        </div>
    </div>
</div>
{/if}

<style>

.backdrop {
    background-color: rgba(0,0,0,.7);
    position: absolute;
    height: 100vh;
    width: 100vw;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
}

.modal {
    height: 40rem;
    width: 54rem;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(5, 1fr);
    grid-column-gap: 2rem;
    grid-row-gap: 2rem;
}

.welcome {
    width: 54rem;
    height: 19rem;
    grid-area: 1 / 1 / 2 / 3;
    border-radius: 1rem;
    background-color: var(--bagel-yellow);
    padding: 1.5rem;
}

.left {
    width: 26rem;
    height: 19rem;
    grid-area: 2 / 1 / 3 / 2;
    border-radius: 1rem;
    background-color: var(--bagel-yellow);
    padding: 1rem;
}

.right {
    width: 26rem;
    height: 19rem;
    grid-area: 2 / 2 / 3 / 3;
    border-radius: 1rem;
    background-color: var(--bagel-yellow);
    padding: 1rem;
}

.button-start {
    background-color: var(--black);
    color: var(--white);
    font-size: 1.4rem;
    width: 15rem;
    height: 5rem;
    margin-bottom: 2rem;
    border: 0;
    border-radius: 1rem;
    cursor: pointer;
}

.left-container {
    display: flex;
    padding: 0.7rem;
}

.right-container {
    display: flex;
    align-items: center;
    gap: 2rem;
    padding: 1rem;
}

input[type="color"] {
    width: 4.2rem;
    height: 2.2rem;
    padding: 0;
    background-color: var(--bagel-yellow-light);
}

.effect-toggle + .tgl-btn {
    margin-left: 13.2rem;
    margin-top: 0.8rem;
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
</style>