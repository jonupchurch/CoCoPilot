import { useMemo, useState } from 'react';

import type { BoardState } from '../../../main/view.js';
import { dismissSession, selectSession, useBoardState } from '../state/useBoardState.js';
import { useNow } from '../state/useNow.js';
import { useUnread } from '../state/useUnread.js';
import { NotesView } from '../views/notes/NotesView.js';
import { OverviewView } from '../views/overview/OverviewView.js';
import { StoriesView } from '../views/stories/StoriesView.js';
import { TasksView } from '../views/tasks/TasksView.js';
import { SessionSwitcher } from './SessionSwitcher.js';
import { TABS, TabStrip, type Tab } from './TabStrip.js';
import { TitleBar } from './TitleBar.js';
import { WaitingState } from './WaitingState.js';

import './App.css';

/**
 * The shell: identity above, navigation below it, one scrolling body beneath.
 *
 * The active tab is component state rather than a route, and it is *not* reset
 * when a report arrives — a developer reading one view must not be moved to
 * another because an agent said something (FR-017).
 */
export function App(): React.JSX.Element {
  const state = useBoardState();
  const now = useNow();
  const [chosen, setChosen] = useState<Tab | null>(null);

  const available = useMemo(() => availableTabs(state), [state]);
  // Falls back rather than resetting: if the tab someone chose stops existing,
  // land on the first one that does. Since decision 36 that happens only when
  // the last session goes, so the choice now survives every report — which is
  // the whole of FR-017 and used to be true only of tabs that stayed populated.
  const active = chosen !== null && available.includes(chosen) ? chosen : (available[0] ?? 'overview');

  // Asked here rather than inside the strip, which knows about destinations and
  // not about notes. `active` is what makes it a rule about the developer's
  // attention rather than about the count alone.
  const unread = useUnread(state.session?.noteCount ?? 0, active === 'notes');

  return (
    <div className="app">
      <TitleBar session={state.session} now={now} />
      {/*
        Between identity and navigation, because it *is* identity: which agent
        the rest of the window is about. Absent entirely below two sessions.
      */}
      <SessionSwitcher
        sessions={state.sessions}
        selected={state.selectedKey}
        now={now}
        onSelect={selectSession}
        onDismiss={dismissSession}
      />
      <TabStrip available={available} active={active} unread={unread} onSelect={setChosen} />

      <main className="app__body" data-testid="body" data-tab={active}>
        {state.session === null ? (
          <WaitingState />
        ) : active === 'overview' ? (
          <OverviewView session={state.session} now={now} />
        ) : active === 'stories' ? (
          <StoriesView session={state.session} now={now} />
        ) : active === 'tasks' ? (
          <TasksView session={state.session} now={now} />
        ) : (
          // The last of the four. There is no placeholder branch any more,
          // because every tab the strip can offer now has a view behind it.
          <NotesView session={state.session} now={now} />
        )}
      </main>
    </div>
  );
}

/**
 * Every destination, from the first report onwards — content or not (decision
 * 36, superseding feature 003's FR-009).
 *
 * FR-009 hid a tab whose view would be empty, on the argument that it would be
 * a dead end. Two things retired that argument. All three views grew their own
 * empty state, so the destination says what it has rather than nothing; and
 * gating on counts meant an agent's report could *take away* the tab a
 * developer was reading, which the fallback above then answered by moving them
 * — a report reaching into someone's attention, which is the thing FR-017
 * exists to forbid.
 *
 * The strip is still absent entirely with nothing held: a session is what the
 * tabs are *about*, so before there is one there is nothing to navigate.
 */
function availableTabs(state: BoardState): Tab[] {
  return state.session === null ? [] : [...TABS];
}
