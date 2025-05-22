import { ListenonlySignal } from "./_internal/listenonly-signal.class.js"
import { MonoCustomEventTarget } from "./_internal/mono-custom-event-target.class.js"

/**
 * A controller object that allows you to dispatch events in listen-only signal.
 *
 * @example
 *  class MyUserModel {
 *      #onChange = new SignalController()
 *      public readonly onChange = this.#onChange.signal
 *
 *      public set name(value: string) {
 *          this.#name = value
 *          this.#onChange.dispatchSignal()
 *      }
 *  }
 *
 *  class MyViewModel {
 *      #user?: MyUserModel
 *
 *      public set user(value: MyUserModel | string) {
 *          const model = value instanceof MyUserModel ? value : new MyUserModel(value)
 *          model.addSignalListener(() => this.#render())
 *          this.#user = model
 *          this.#render()
 *      }
 *
 *      #render() {
 *          // ...
 *      }
 *  }
 */
export class SignalController<T> {
    #internalEventProvider = new MonoCustomEventTarget<T>()

    #signal = new ListenonlySignal<T>(this.#internalEventProvider)

    /** Returns the Signal object associated with this object. */
    get signal() {
        return this.#signal
    }

    /** Invoking this method will signal to any observers that the associated activity is to be beginned. */
    dispatchSignal(detail?: T): boolean {
        return this.#internalEventProvider.dispatchEvent({ detail, cancelable: false })
    }
}
