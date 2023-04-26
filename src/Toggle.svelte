<script>
    export let id;
    export let opt;

</script>

<div class="backdrop">
    <h3 class="label">{id}</h3>

    <label class="switch">
        <input type="checkbox" bind:checked={opt}>
        <span class="slider"></span>
    </label>

</div>

<style>

    .backdrop {
        /* background-color: aqua; */
        height: 7.5rem;
    }

    .label {
        color: var(--header-brown-dark);
        text-align: center;
    }

    .switch {
        position: relative;
        display: inline-block;
        width: 3.75rem;
        height: 2.125rem;
        transform: rotate(-90deg);
    }

    /* hide default checkbox */
    .switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }

    .slider {
        border-radius: 0.75rem;
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--bagel-yellow-light);
        -webkit-transition: .4s;
        transition: .4s;
    }

    .slider:before {
        border-radius: 30%;
        position: absolute;
        content: "";
        height: 1.625rem;
        width: 1.625rem;
        left: 0.25rem;
        bottom: 0.25rem;
        background-color: var(--bagel-red);
        -webkit-transition: .4s;
        transition: .4s;
    }

    input:checked + .slider {
        background-color: var(--white);
    }

    input:checked + .slider:before {
        -webkit-transform: translateX(1.625rem);
        -ms-transform: translateX(1.625rem);
        transform: translateX(1.625rem);
    }

</style>