<script>

import Header from "./Header.svelte";
import Sidebar from "./Sidebar.svelte";
import Control from "./Control.svelte";

let colorA;
let colorB;
let colorC;

</script>

<div>

	<!-- <Header /> -->
	
	<div class="container">

		<Sidebar 
			bind:colorA_hex={colorA}
			bind:colorB_hex={colorB}
			bind:colorC_hex={colorC}
			/>
		
		<Control 
			bind:colorA_hex={colorA}
			bind:colorB_hex={colorB}
			bind:colorC_hex={colorC}/>

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