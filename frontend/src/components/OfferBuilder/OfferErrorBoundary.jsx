import React from "react";
import { AlertTriangle } from "lucide-react";
import { makeT } from "./i18n/offerT";

// If anything in the offer builder throws while rendering (e.g. a damaged
// offer from an old browser draft), only the builder is replaced by this
// message - the upload, the sidebar and the rest of the app keep working.
// "Start a new offer" clears the offer that caused it; the drawings stay
// stored in All Offers. A class component, because only those can catch
// render errors in React.
class OfferErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // kept in the browser console for whoever has to look into it
    console.error("Offer builder failed to render", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // the app's language as its switch stores it (this component sits
    // outside the hooks that normally provide it)
    let language = "de";
    try {
      if (window.localStorage.getItem("appLanguage") === "EN") language = "en";
    } catch {
      // storage blocked - German
    }
    const t = makeT(language);
    return (
      <section className="ob-crash" role="alert">
        <AlertTriangle size={20} />
        <div>
          <h3>{t("crash.title")}</h3>
          <p>{t("crash.text")}</p>
          <div className="ob-crash-actions">
            <button type="button" onClick={() => window.location.reload()}>
              {t("crash.reload")}
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={() => {
                this.props.onReset?.();
                this.setState({ error: null });
              }}
            >
              {t("crash.reset")}
            </button>
          </div>
        </div>
      </section>
    );
  }
}

export default OfferErrorBoundary;
