<script>

import Sidebar from "./Sidebar.svelte";
import Control from "./Control.svelte";
import Modal from "./Modal.svelte"

let showModal = true;
let preset;
let presetSaving;

const toggleModal = () => {
	showModal = !showModal;
}

</script>

<Modal {showModal} on:click={toggleModal}/>

<div>

	<!-- <Header /> -->
	
	<div class="container">

		<button class="showModal" on:click={toggleModal}>i</button>

		<Sidebar 
			bind:presetString={preset}
			bind:presetSaving={presetSaving}
			/>
		
		<Control 
			bind:presetString={preset}
			bind:presetSaving={presetSaving}/>

	</div>

</div>

<style>
	.container {
		display: flex;
		width: 100%;
		height: 100%;
		flex-wrap: nowrap;
		background-color: var(--bg-beige);
	}

	.showModal {
		-webkit-appearance: none;
		appearance: none;
		background-color: var(--white);
		position: absolute;
		bottom: 1rem;
		left: 1rem;
		height: 3rem;
		width: 3rem;
		border-radius: 50%;
		cursor: pointer;
		font-size: 160%;
	}
</style>