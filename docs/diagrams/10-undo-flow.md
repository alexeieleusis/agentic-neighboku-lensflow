# Phase 10 — how a single Undo click flows

Vertical trace of one enabled undo click, through the four layers it
touches: the `UndoButton` component, the App → `UndoButton` magnified
telescope, the Phase 3 move engine, and the shell re-render.

```mermaid
flowchart TD
    subgraph UI ["UI - UndoButton component"]
        A["Undo button, ENABLED<br/>(slice: placedMoves = n &gt; 0)<br/>disabled = n === 0 - the s5.7/s8.4 UI guard"]
        B["useUndoButtonViewModel.undo()<br/>click -&gt; props.telescope.update({ placedMoves: n - 1 })<br/>writes to the MAGNIFIED child telescope, not the root"]
        A --> B
    end

    subgraph TELE ["Telescope - App to UndoButton magnified telescope, in App.tsx"]
        C["Magnified telescope routes the write to the root:<br/>root.evolve( u =&gt; UNDO_BUTTON_LENS.set(write, u) )"]
        D["UNDO_BUTTON_LENS.set is the COMMIT PATH:<br/>{ ...appState, game: undoPlay(appState.game) }<br/>The written slice value is not read - any child write means 'undo one move';<br/>only the move engine can derive the rest of the new Game"]
        C --> D
    end

    subgraph DOMAIN ["Domain - undoPlay in gameBuilder.ts, Phase 3, untouched"]
        E["undoPlay(game) - DELIBERATELY UNGUARDED (s8.4)<br/>1. last = placedCells.at(-1)!  - would throw on empty history, unreachable: the button is the guard<br/>2. tray[pieceValue] += 1<br/>3. board[cell] = null<br/>4. recompute pieceToFitCells + cellToFitPieces"]
    end

    subgraph SHELL ["Shell re-render"]
        F["New AppState: the spread makes a fresh reference,<br/>so distinctUntilChanged on the root stream passes it through"]
        G["main.tsx start-up subscription<br/>(telescope.stream.forEach -&gt; root.render)<br/>re-renders the whole App tree with new snapshot props - children never subscribe themselves"]
        H["Slices re-derive from the new game:<br/>- board slice: undone cell shows blank<br/>- tray slice: piece count restored<br/>- undo slice: UNDO_BUTTON_LENS.get -&gt; placedMoves = n - 1"]
        F --> G --> H
    end

    I{"n - 1 === 0 ?"}
    J["placedMoves = 0 - button DISABLED again<br/>unguarded undoPlay unreachable (s8.4 satisfied)"]
    K["button stays enabled for the next undo"]

    B --> C
    D --> E
    E --> F
    H --> I
    I -->|yes| J
    I -->|no| K
```
