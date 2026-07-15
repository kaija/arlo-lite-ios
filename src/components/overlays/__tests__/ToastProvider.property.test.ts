import fc from 'fast-check';
import { useUIStore } from '@/stores/ui-store';

/**
 * Property-based tests for toast replacement behavior.
 *
 * **Validates: Requirements 12.5**
 *
 * Feature: mockup-ui-implementation, Property 7: Toast replacement resets timer
 *
 * Property: For any sequence of toast triggers, if a new toast is triggered while
 * an existing toast is visible, the displayed message SHALL be the most recently
 * triggered message.
 *
 * We test the state replacement aspect here (the timer reset is inherently
 * time-dependent and validated in the unit test). The key invariant is:
 * after any sequence of showToast calls, the store's toastMessage always
 * equals the last message in the sequence and toastVisible is true.
 */

describe('Property: Toast replacement resets timer', () => {
  beforeEach(() => {
    // Reset the Zustand store to initial state before each test
    useUIStore.setState({
      toastMessage: null,
      toastVisible: false,
    });
  });

  it('after any non-empty sequence of showToast calls, toastMessage equals the last message', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 80 }), {
          minLength: 1,
          maxLength: 20,
        }),
        (messages) => {
          // Reset before each run
          useUIStore.setState({ toastMessage: null, toastVisible: false });

          const { showToast } = useUIStore.getState();

          // Trigger all messages in rapid sequence (simulating replacement)
          for (const msg of messages) {
            showToast(msg);
          }

          const state = useUIStore.getState();
          const lastMessage = messages[messages.length - 1];

          // The displayed message must be the most recently triggered one
          return state.toastMessage === lastMessage && state.toastVisible === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a single toast trigger sets the message and visible state correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 80 }),
        (message) => {
          useUIStore.setState({ toastMessage: null, toastVisible: false });

          const { showToast } = useUIStore.getState();
          showToast(message);

          const state = useUIStore.getState();
          return state.toastMessage === message && state.toastVisible === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('replacing a visible toast always overwrites the previous message', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 80 }),
        fc.string({ minLength: 1, maxLength: 80 }),
        (firstMessage, secondMessage) => {
          useUIStore.setState({ toastMessage: null, toastVisible: false });

          const { showToast } = useUIStore.getState();

          // Show first toast
          showToast(firstMessage);
          const afterFirst = useUIStore.getState();
          const firstCorrect =
            afterFirst.toastMessage === firstMessage && afterFirst.toastVisible === true;

          // Replace with second toast (while first is still "visible")
          showToast(secondMessage);
          const afterSecond = useUIStore.getState();
          const secondCorrect =
            afterSecond.toastMessage === secondMessage && afterSecond.toastVisible === true;

          return firstCorrect && secondCorrect;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any interleaved sequence, the store never contains a message that is not the latest', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 80 }), {
          minLength: 2,
          maxLength: 30,
        }),
        (messages) => {
          useUIStore.setState({ toastMessage: null, toastVisible: false });

          const { showToast } = useUIStore.getState();

          // After each showToast call, verify the state matches the latest message
          for (let i = 0; i < messages.length; i++) {
            showToast(messages[i]);
            const state = useUIStore.getState();
            if (state.toastMessage !== messages[i]) return false;
            if (state.toastVisible !== true) return false;
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
