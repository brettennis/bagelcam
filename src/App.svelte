<script>

import Header from "./Header.svelte";
import Sidebar from "./Sidebar.svelte";
import Control from "./Control.svelte";

let preset;
let presetSaving;

</script>

<div>

	<!-- <Header /> -->
	
	<div class="container">

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
</style>