import { useMemo, useState } from 'react';

import type { BoardState } from '../../../main/view.js';
import { useBoardState } from '../state/useBoardState.js';
import { useNow } from '../state/useNow.js';
import { OverviewView } from '../views/overview/OverviewView.js';
import { StoriesView } from '../views/stories/StoriesView.js';
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

  return (
    <div className="app">
      <TitleBar session={state.session} now={now} />
      <TabStrip available={available} active={active} onSelect={setChosen} />

      <main className="app__body" data-testid="body" data-tab={active}>
        {state.session === null ? (
          <WaitingState />
        ) : active === 'overview' ? (
          <OverviewView session={state.session} now={now} />
        ) : active === 'stories' ? (
          <StoriesView session={state.session} now={now} />
        ) : (
          // Feature 007 fills Notes in. Until then the frame is honest about
          // being a frame rather than pretending to have content.
          <div className="app__placeholder" data-testid="view-placeholder">
            Nothing to show in this view yet.
          </div>
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
