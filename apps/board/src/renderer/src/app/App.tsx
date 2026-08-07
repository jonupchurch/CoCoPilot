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
import { TabStrip, type Tab } from './TabStrip.js';
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
  // land on the first one that does instead of snapping them elsewhere on every
  // report.
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
 * A tab is offered only when its view has something in it (FR-009). Overview
 * needs only a session, because identity and focus are always worth showing.
 */
function availableTabs(state: BoardState): Tab[] {
  const { session } = state;
  if (session === null) return [];

  const tabs: Tab[] = ['overview'];
  if (session.storyCount > 0) tabs.push('stories');
  if (session.taskCount > 0) tabs.push('tasks');
  if (session.noteCount > 0) tabs.push('notes');
  return tabs;
}
