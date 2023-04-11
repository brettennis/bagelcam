<script>
    export let id;
    export let opt1;
    export let opt2;
    export let opt3;
    export let opt4;
    export let optionChosen = 1;

    // position white div based on option chosen
    $: selectedPosition = 25 * (optionChosen - 1);

</script>

<div class="backdrop">

    <h3>{id}</h3>

    <div class="options">

        <div class="selected" style="--selectedPosition:{selectedPosition}%;"></div>

        <label class="option">
            <input type="radio" bind:group={optionChosen} name={id} value={1}>
            {opt1}
        </label>

        <label class="option">
            <input type="radio" bind:group={optionChosen} name={id} value={2}>
            {opt2}
        </label>

        <label class="option">
            <input type="radio" bind:group={optionChosen} name={id} value={3}>
            {opt3}
        </label>

        <label class="option">
            <input type="radio" bind:group={optionChosen} name={id} value={4}>
            {opt4}
        </label>
    </div>

</div>

<style>

.backdrop {
    width: 10rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
}

h3 {
    margin: .7rem;
}

.options {
    margin: 0;
    padding: 0;
    position: relative;
    background-color: var(--light-gray);
    width: 10rem;
    height: 12rem;
    border-radius: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
}

.option {
    color: var(--black);
    padding: 1rem;
    width: 100%;
    height: 25%;
    cursor: pointer;
    text-align: left;
    z-index: 0;
}

.option input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
}

.selected {
    position: absolute;
    background-color: var(--white);
    top: var(--selectedPosition);
    width: 100%;
    height: 25%;
    border-radius: 1rem;
    cursor: pointer;
    transition: top .08s;
}

</style>