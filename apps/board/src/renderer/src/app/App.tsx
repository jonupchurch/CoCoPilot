import { useCallback, useMemo, useState } from 'react';

import type { BoardState } from '../../../main/view.js';
import { dismissSession, selectSession, useBoardState } from '../state/useBoardState.js';
import { useNow } from '../state/useNow.js';
import { usePresence } from '../state/usePresence.js';
import { useUnread } from '../state/useUnread.js';
import { NotesView } from '../views/notes/NotesView.js';
import { OverviewView } from '../views/overview/OverviewView.js';
import { SpecKitView } from '../views/speckit/SpecKitView.js';
import { StoriesView } from '../views/stories/StoriesView.js';
import { TasksView } from '../views/tasks/TasksView.js';
import { TicketView } from '../views/ticket/TicketView.js';
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

  const presence = usePresence(state.selectedKey, state.session?.everReportedStories ?? false);
  const available = useMemo(
    () => availableTabs(state, presence.tree, presence.oldViews),
    [state, presence.tree, presence.oldViews],
  );
  // Falls back rather than resetting: if the tab someone chose stops existing,
  // land on the first one that does. Since decision 36 that happens only when
  // the last session goes, so the choice now survives every report — which is
  // the whole of FR-017 and used to be true only of tabs that stayed populated.
  const active = chosen !== null && available.includes(chosen) ? chosen : (available[0] ?? 'overview');

  // Asked here rather than inside the strip, which knows about destinations and
  // not about notes. `active` is what makes it a rule about the developer's
  // attention rather than about the count alone, and `selectedKey` is what keeps
  // the count comparable: two sessions' note counts mean nothing subtracted.
  const unread = useUnread(state.selectedKey, state.session?.noteCount ?? 0, active === 'notes');

  /**
   * Choosing a destination, and remembering it if it was one of the two the tree
   * displaces.
   *
   * Recorded **on the navigation** rather than on a render of either view. A
   * view can render for reasons that are not a developer going there — a
   * fallback, a re-render, a future preloading of something — and any of those
   * marking it used would keep a destination alive that nobody asked for.
   */
  const chooseTab = useCallback(
    (tab: Tab): void => {
      if (tab === 'stories' || tab === 'tasks') presence.noteOldViewOpened();
      setChosen(tab);
    },
    [presence],
  );

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
      <TabStrip available={available} active={active} unread={unread} onSelect={chooseTab} />

      <main className="app__body" data-testid="body" data-tab={active}>
        {state.session === null ? (
          <WaitingState />
        ) : active === 'overview' ? (
          <OverviewView session={state.session} now={now} />
        ) : active === 'ticket' ? (
          <TicketView session={state.session} now={now} />
        ) : active === 'speckit' ? (
          <SpecKitView session={state.session} now={now} />
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
function availableTabs(state: BoardState, tree: boolean, oldViews: boolean): Tab[] {
  if (state.session === null) return [];

  /*
   * Four conditional destinations, and they do not contradict the paragraph
   * above.
   *
   * FR-009 gated a tab on a *count*, so an agent reporting no tasks withdrew the
   * Tasks tab from whoever was reading it. These gate on whether the session has
   * ever had the *concept*: a project with no user stories is not a Spec-Kit
   * project, and one that has had them keeps the tree even when a later report
   * carries none (feature 011, FR-003). No count gates anything here.
   *
   * The Stories and Tasks views leave where the tree arrives — but only for a
   * developer who has never opened either of them in this session. Both of
   * `usePresence`'s booleans are one-way, so nothing can be taken from someone
   * who was reading it, which is precisely the fault decision 36 was raised
   * about. The rule lives there; this function only asks.
   *
   * **The ticket is the fourth, on the same principle** (feature 010, FR-001 and
   * FR-002). A session working from repository specs has no ticket *concept* —
   * not a ticket with nothing in it, which is decision 33's empty-versus-
   * unavailable distinction applied a level up — so the destination is absent
   * rather than empty, and it is the only tab that is ever absent once a session
   * exists.
   *
   * It cannot be withdrawn, because `session.ticket` is only ever set by
   * `/v1/ticket`: no report can clear it, and there is no endpoint that removes
   * one. So the resemblance to the regression decision 36 forbids is only a
   * resemblance. This condition lives here rather than in `usePresence` because
   * that file says so itself — it governs the tree and the two views the tree
   * displaces, and nothing else.
   */
  return TABS.filter((tab) => {
    if (tab === 'ticket') return state.session?.ticket != null;
    if (tab === 'speckit') return tree;
    if (tab === 'stories' || tab === 'tasks') return oldViews;
    return true;
  });
}
