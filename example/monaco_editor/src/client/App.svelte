<script>
  import { executeFixAllFixableProblemsCommand } from './client'

  const commands = [
    { id: 'fixAllFixableProblems', text: 'fixAllFixableProblems' },
    // TODO
    // { id: 'switchDatabaseConnection', text: 'switchDatabaseConnection' },
  ]

  let command = commands[0]

  function handleSubmitCommand() {
    if (command.id === 'fixAllFixableProblems') {
      executeFixAllFixableProblemsCommand()
    }
  }
</script>

<h1>Monaco Language Client SQLLanguageServer Sample</h1>

<form on:submit|preventDefault={handleSubmitCommand}>
  <select bind:value={command}>
    {#each commands as command}
      <option value={command}>
        {command.text}
      </option>
    {/each}
  </select>
  <button type=submit>Submit</button>
</form>

<div id="container" style="width:800px;height:600px;border:1px solid grey"></div>