<script>
    export let showModal = true;
</script>

{#if showModal}
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="backdrop" on:click>
    <div class="modal">
        <p> Click anywhere to dismiss </p>
    </div>
</div>
{/if}

<style>
    .backdrop {
        background-color: rgba(0,0,0,.5);
        position: absolute;
        height: 100vh;
        width: 100vw;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
    }

    .modal {
        height: 30rem;
        width: 50rem;
        background-color: blueviolet;
    }
</style>