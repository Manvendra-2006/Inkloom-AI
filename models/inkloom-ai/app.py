
import json
import os
from datetime import datetime

import requests
import streamlit as st




st.set_page_config(
    page_title="Inkloom AI | Brand Governance",
    page_icon="✳",
    layout="wide",
    initial_sidebar_state="expanded",
)

API_BASE = "http://127.0.0.1:8000"
NODE_API_BASE = os.getenv("INKLOOM_NODE_API_BASE", "http://127.0.0.1:5000/api")




DEFAULTS = {
    "history": [],
    "brand_id": None,
    "brand_profile_id": None,
    "brand_profile_data": None,
    "brand_name": "",
    "brand_description": "",
    "brand_tone": "",
    "preferred_terms": "",
    "review_terms": "",
    "editor_text": "",
    "ad_title": "",
    "latest_audit": None,
    "suggestion_result": None,
    "suggestion_text": "",
    "suggestion_title": "",
    "page_choice": "Overview",
}

for key, value in DEFAULTS.items():
    if key not in st.session_state:
        st.session_state[key] = value


if "next_page" in st.session_state:
    st.session_state.page_choice = st.session_state.pop("next_page")





def api_get(path):
    """Send a GET request to the backend."""
    response = requests.get(
        f"{API_BASE}{path}",
        timeout=8,
    )
    response.raise_for_status()
    return response.json()


def api_post(path, payload, timeout=120):
    """Send a JSON POST request to the backend."""
    response = requests.post(
        f"{API_BASE}{path}",
        json=payload,
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def save_profile_to_node(payload, profile_id=None):
    """Persist a Streamlit-managed profile through the authenticated Node API."""
    token = os.getenv("INKLOOM_NODE_API_TOKEN")
    if not token:
        raise RuntimeError(
            "Set INKLOOM_NODE_API_TOKEN to an administrator JWT before saving profiles."
        )

    method = requests.put if profile_id else requests.post
    endpoint = f"{NODE_API_BASE}/brand-profiles"
    if profile_id:
        endpoint = f"{endpoint}/{profile_id}"
    response = method(
        endpoint,
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def split_terms(value):
    """Convert comma-separated text into a list."""
    return [
        term.strip()
        for term in value.split(",")
        if term.strip()
    ]


def get_combined_findings(result):
    """Support current and older backend response formats."""
    findings = result.get("combined_findings")

    if isinstance(findings, list):
        return findings

    rule_result = result.get("rule_based", {})

    if isinstance(rule_result, dict):
        findings = rule_result.get("findings", [])
        if isinstance(findings, list):
            return findings

    return []


def audit_advertisement(text, title):
    """Audit advertisement copy and save the result in session history."""
    payload = {"text": text}

    if st.session_state.get("brand_profile_data"):
        profile = st.session_state.brand_profile_data
        payload["brand_guideline"] = {
            "name": profile["name"],
            "description": profile["description"],
            "tone_of_voice": profile["toneOfVoice"],
            "preferred_terminology": profile["preferredTerminology"],
            "terms_requiring_review": profile["termsRequiringReview"],
        }
    elif st.session_state.brand_id:
        payload["brand_id"] = st.session_state.brand_id

    result = api_post("/audit", payload)
    findings = get_combined_findings(result)

    record = {
        "id": datetime.now().strftime("%Y%m%d%H%M%S%f"),
        "title": title.strip() or "Untitled advertisement",
        "text": text,
        "findings": findings,
        "result": result,
        "created_at": datetime.now().strftime(
            "%d %b %Y, %I:%M %p"
        ),
        "human_review_required": True,
    }

    st.session_state.history.insert(0, record)
    st.session_state.latest_audit = record

    return record


def clear_editor():
    """Clear editor state before Streamlit redraws the page."""
    st.session_state.editor_text = ""
    st.session_state.ad_title = ""
    st.session_state.latest_audit = None




def metric_card(label, value, caption):
    st.markdown(
        f"""
        <div class="metric-card">
            <div class="metric-label">{label}</div>
            <div class="metric-number">{value}</div>
            <div class="metric-caption">{caption}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def show_findings(findings):
    if not findings:
        st.success(
            "No potential issues were flagged in this audit."
        )
        st.caption(
            "This does not guarantee compliance. Verify claims, "
            "supporting evidence, assets and context before publication."
        )
        return

    st.markdown(f"### {len(findings)} potential finding(s)")

    for index, finding in enumerate(findings, start=1):
        if not isinstance(finding, dict):
            continue

        mapping_status = finding.get("mapping_status") or (
            "mapped" if finding.get("guideline_id") else "unmapped"
        )
        title = (
            finding.get("title")
            or finding.get("guideline_id")
            or (
                "AI-detected issue"
                if mapping_status == "unmapped"
                else finding.get("category")
            )
            or f"Potential issue {index}"
        )

        severity = str(
            finding.get("severity", "Medium")
        ).capitalize()

        explanation = (
            finding.get("explanation")
            or finding.get("reason")
            or finding.get("description")
            or "This wording may need further review."
        )

        matched_text = (
            finding.get("matched_text")
            or finding.get("matched")
            or ""
        )

        category = finding.get("category", "Brand review")
        guideline = finding.get("guideline_id", "")
        raw_sources = finding.get("sources") or finding.get("source") or "AI"
        sources = raw_sources if isinstance(raw_sources, list) else [raw_sources]
        source_names = {
            "ai": "AI",
            "ai_review": "AI",
            "rule": "Rule",
            "rule_based": "Rule",
            "brand_custom": "Brand Custom",
        }
        source = ", ".join(
            source_names.get(item, str(item))
            for item in dict.fromkeys(sources)
        )
        extra = finding.get("additional_explanations", [])

        with st.container(border=True):
            left, right = st.columns([4, 1])

            with left:
                st.markdown(f"**{index}. {title}**")
                caption = str(category)
                if guideline:
                    caption = f"Guideline ID: {guideline} · {caption}"
                st.caption(caption)
                st.caption(
                    f"Source: {source} · Mapping: {mapping_status.capitalize()}"
                )
                if mapping_status != "mapped":
                    st.warning("No matching configured guideline.")

            with right:
                if severity == "High":
                    st.error(severity)
                elif severity == "Medium":
                    st.warning(severity)
                else:
                    st.info(severity)

            st.write(explanation)

            if matched_text:
                st.markdown("**Matched wording**")
                st.code(str(matched_text), language=None)

            if extra:
                if isinstance(extra, str):
                    extra = [extra]

                if isinstance(extra, list):
                    with st.expander("Additional context"):
                        for item in extra:
                            if isinstance(item, dict):
                                item = (
                                    item.get("explanation")
                                    or item.get("reason")
                                    or json.dumps(
                                        item,
                                        ensure_ascii=False,
                                    )
                                )
                            st.write(f"• {item}")


def show_audit_record(record):
    st.markdown("### Audit report")
    st.caption(
        f"{record['title']} · {record['created_at']}"
    )

    show_findings(record.get("findings", []))

    st.markdown(
        """
        <div class="notice">
            <strong>Human review required</strong><br>
            These findings support a review. They do not replace
            human judgment, verification of evidence or legal review.
        </div>
        """,
        unsafe_allow_html=True,
    )


def show_backend_error(error):
    """Show a useful message without exposing a full traceback."""
    st.error(
        "The backend request failed. Make sure your API server is "
        "running at http://127.0.0.1:8000 and try again."
    )
    with st.expander("Technical details"):
        st.code(str(error))


def generate_improvements(text, findings, title=""):
    """Request optional copy suggestions from the FastAPI endpoint."""
    payload = {
        "text": text.strip(),
        "audit_findings": findings if isinstance(findings, list) else [],
    }

    if st.session_state.get("brand_id"):
        payload["brand_id"] = st.session_state.brand_id

    return api_post("/suggest-improvements", payload, timeout=120)




with st.sidebar:
    st.markdown(
        """
        <div style="font-size:30px;font-weight:800;letter-spacing:-1px">
            inkloom <span style="font-weight:400">AI</span>
        </div>
        <div style="font-size:10px;letter-spacing:2px;opacity:.7">
            BRAND GOVERNANCE STUDIO
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.divider()

    page = st.radio(
        "WORKSPACE",
        [
            "Overview",
            "Create & Audit",
            "Suggestions",
            "Audit History",
            "Brand Profile",
        ],
        key="page_choice",
    )

    st.divider()

    st.markdown("**Human-in-the-loop**")
    st.caption(
        "Potential risks are identified for a human to review. "
        "Inkloom does not automatically approve advertisements."
    )




if page == "Overview":
    st.markdown(
        """
        <div class="hero">
            <h1>Keep every campaign on-brand.</h1>
            <p>
                Check advertising claims, identify potential brand risks,
                and prepare copy for human review.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    history = st.session_state.history
    total = len(history)
    flagged = sum(bool(item["findings"]) for item in history)
    total_findings = sum(
        len(item["findings"]) for item in history
    )

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        metric_card("Ads audited", total, "Current session")

    with col2:
        metric_card(
            "Potentially flagged",
            flagged,
            "Audits with findings",
        )

    with col3:
        metric_card(
            "Findings",
            total_findings,
            "Potential risks detected",
        )

    with col4:
        metric_card(
            "Human review",
            "Required" if total else "—",
            "Before publication",
        )

    st.markdown(
        '<div class="section-heading">Get started</div>',
        unsafe_allow_html=True,
    )

    col1, col2 = st.columns(2)

    with col1:
        with st.container(border=True):
            st.markdown("### ✍️ Create & audit")
            st.write(
                "Write or paste an advertisement and check it "
                "against the configured brand rules."
            )

            if st.button(
                "Open advertisement editor",
                type="primary",
                use_container_width=True,
            ):
                st.session_state.next_page = "Create & Audit"
                st.rerun()

    with col2:
        with st.container(border=True):
            st.markdown("### ◈ Brand profile")
            st.write(
                "Register your brand and configure its tone and "
                "terminology for future audits."
            )

            if st.button(
                "Configure brand profile",
                use_container_width=True,
            ):
                st.session_state.next_page = "Brand Profile"
                st.rerun()

    if history:
        st.markdown(
            '<div class="section-heading">Recent audits</div>',
            unsafe_allow_html=True,
        )

        for item in history[:5]:
            with st.container(border=True):
                left, right = st.columns([4, 1])

                with left:
                    st.markdown(f"**{item['title']}**")
                    st.caption(item["created_at"])

                with right:
                    if item["findings"]:
                        st.warning(
                            f"{len(item['findings'])} finding(s)"
                        )
                    else:
                        st.success("No flags")

                if st.button(
                    "View report",
                    key=f"overview_{item['id']}",
                ):
                    st.session_state.latest_audit = item
                    st.session_state.next_page = "Audit History"
                    st.rerun()
    else:
        st.info(
            "Your audit activity will appear here after your first "
            "audit. No sample activity has been added."
        )




elif page == "Create & Audit":
    st.title("Create & audit an advertisement")
    st.write(
        "Check your copy, review potential risks, and revise it "
        "before submitting it for human review."
    )

    left, right = st.columns([1.1, 0.9], gap="large")

    with left:
        with st.container(border=True):
            st.markdown("### Advertisement editor")

            st.text_input(
                "Advertisement name",
                placeholder="e.g. Product launch campaign",
                key="ad_title",
            )

            st.text_area(
                "Advertisement copy",
                height=260,
                placeholder=(
                    "Write or paste your advertisement here..."
                ),
                key="editor_text",
            )

            col_a, col_b = st.columns(2)

            with col_a:
                run = st.button(
                    "Run brand audit",
                    type="primary",
                    use_container_width=True,
                )

            with col_b:
                st.button(
                    "Clear editor",
                    use_container_width=True,
                    on_click=clear_editor,
                )

            if run:
                clean_text = st.session_state.editor_text.strip()
                title = st.session_state.ad_title.strip()

                if not clean_text:
                    st.warning("Enter advertisement copy first.")
                else:
                    try:
                        with st.spinner(
                            "Analyzing advertisement..."
                        ):
                            audit_advertisement(clean_text, title)
                        st.rerun()

                    except requests.RequestException as error:
                        show_backend_error(error)

                    except (ValueError, KeyError, TypeError) as error:
                        st.error(
                            "We couldn't interpret the audit result."
                        )
                        with st.expander("Technical details"):
                            st.code(str(error))

            st.caption(
                "Audit results identify potential risks. Verify "
                "factual claims and supporting evidence independently."
            )

    with right:
        with st.container(border=True):
            st.markdown("### Audit results")

            record = st.session_state.latest_audit

            if record:
                show_audit_record(record)
            else:
                st.info(
                    "Your findings will appear here after you run "
                    "an audit."
                )

    if st.session_state.latest_audit:
        record = st.session_state.latest_audit

        st.divider()
        st.markdown("### Improve your copy")
        st.write(
            "Revise the advertisement using the findings above. "
            "The revised text is not automatically approved."
        )

        revised = st.text_area(
            "Revised advertisement",
            value=record["text"],
            height=180,
            key=f"revised_{record['id']}",
        )

        if st.button("Check revised copy", type="primary"):
            if not revised.strip():
                st.warning("Enter the revised copy first.")
            else:
                try:
                    with st.spinner(
                        "Checking revised advertisement..."
                    ):
                        audit_advertisement(
                            revised.strip(),
                            record["title"],
                        )
                    st.session_state.editor_text = revised.strip()
                    st.session_state.ad_title = record["title"]
                    st.rerun()

                except requests.RequestException as error:
                    show_backend_error(error)

                except (ValueError, KeyError, TypeError) as error:
                    st.error(
                        "We couldn't interpret the revised audit result."
                    )
                    with st.expander("Technical details"):
                        st.code(str(error))




elif page == "Audit History":
    st.title("Audit history")
    st.write("Reports created during the current session.")

    history = st.session_state.history

    if not history:
        st.info(
            "There are no audits yet. Run your first audit to build "
            "your session history."
        )
    else:
        selected = st.selectbox(
            "Select an advertisement",
            options=history,
            format_func=lambda item: (
                f"{item['title']} — {item['created_at']}"
            ),
            key="selected_audit",
        )

        if selected:
            show_audit_record(selected)

            with st.expander("View full audit response"):
                st.json(selected["result"])

            if st.button("Load copy into editor"):
                st.session_state.editor_text = selected["text"]
                st.session_state.ad_title = selected["title"]
                st.session_state.latest_audit = selected
                st.session_state.next_page = "Create & Audit"
                st.rerun()

        st.download_button(
            "Export session audit history",
            data=json.dumps(
                history,
                ensure_ascii=False,
                indent=2,
                default=str,
            ),
            file_name="inkloom_audit_history.json",
            mime="application/json",
        )





elif page == "Suggestions":
    st.title("AI copy suggestions")
    st.write(
        "Generate optional wording improvements from the current advertisement "
        "and its audit findings. Suggestions are drafts, not compliance approval."
    )

    latest = st.session_state.get("latest_audit")
    if not st.session_state.suggestion_text.strip():
        if latest and latest.get("text"):
            st.session_state.suggestion_text = latest["text"]
            st.session_state.suggestion_title = latest.get("title", "")
        elif st.session_state.editor_text.strip():
            st.session_state.suggestion_text = st.session_state.editor_text
            st.session_state.suggestion_title = st.session_state.ad_title

    if st.session_state.get("brand_profile_data") and not st.session_state.get("brand_id"):
        st.info(
            "Your saved brand profile is stored through the separate Node/MongoDB API. "
            "This suggestions endpoint currently accepts a FastAPI brand_id, so it will "
            "use its default demo brand unless that brand is also registered in FastAPI."
        )

    with st.container(border=True):
        st.markdown("### Advertisement to improve")

        if st.button("Load latest audited copy", use_container_width=False):
            if latest:
                st.session_state.suggestion_text = latest.get("text", "")
                st.session_state.suggestion_title = latest.get("title", "")
                st.session_state.suggestion_result = None
                st.rerun()
            else:
                st.warning("Run an audit first, or paste advertisement copy below.")

        st.text_input(
            "Advertisement name",
            key="suggestion_title",
            placeholder="e.g. Product launch campaign",
        )
        st.text_area(
            "Advertisement copy",
            key="suggestion_text",
            height=220,
            placeholder="Paste or load advertisement copy here...",
        )

        if latest and st.session_state.suggestion_text.strip() == latest.get("text", "").strip():
            st.caption("The latest audit findings will be included with this request.")
        else:
            st.caption(
                "If this text differs from the latest audited copy, suggestions will be "
                "generated without those audit findings. Run an audit first for better context."
            )

        if st.button("✨ Generate suggestions", type="primary", use_container_width=True):
            source_text = st.session_state.suggestion_text.strip()
            if not source_text:
                st.warning("Enter advertisement copy first.")
            else:
                findings = []
                if latest and source_text == latest.get("text", "").strip():
                    findings = latest.get("findings", [])
                try:
                    with st.spinner("Asking the AI for wording improvements..."):
                        result = generate_improvements(
                            source_text,
                            findings,
                            st.session_state.suggestion_title,
                        )
                    st.session_state.suggestion_revised_draft = result.get("revised_draft", "")
                    st.session_state.suggestion_result = {
                        "source_text": source_text,
                        "title": st.session_state.suggestion_title.strip() or "Untitled advertisement",
                        "result": result,
                    }
                except requests.HTTPError as error:
                    st.error("The suggestion request was rejected by the backend.")
                    with st.expander("Technical details"):
                        st.code(str(error))
                        if error.response is not None:
                            st.code(error.response.text)
                except requests.RequestException as error:
                    show_backend_error(error)
                except (ValueError, KeyError, TypeError) as error:
                    st.error("We couldn't interpret the suggestion response.")
                    with st.expander("Technical details"):
                        st.code(str(error))

    suggestion_record = st.session_state.get("suggestion_result")
    if suggestion_record:
        result = suggestion_record.get("result", {})
        st.divider()
        st.markdown("### Suggested improvements")
        st.caption(
            f"For: {suggestion_record.get('title', 'Untitled advertisement')} · "
            "Review every suggestion before using it."
        )

        suggestions = result.get("suggestions", [])
        if not isinstance(suggestions, list) or not suggestions:
            st.info("The model did not return phrase-level suggestions for this copy.")
        else:
            for index, item in enumerate(suggestions, start=1):
                if not isinstance(item, dict):
                    continue
                priority = str(item.get("priority", "medium")).capitalize()
                with st.container(border=True):
                    left, right = st.columns([4, 1])
                    with left:
                        st.markdown(f"**{index}. {item.get('issue', 'Wording to review')}**")
                        original = item.get("original_text", "")
                        replacement = item.get("suggested_replacement", "")
                        if original:
                            st.markdown("**Original phrase**")
                            st.code(str(original), language=None)
                        if replacement:
                            st.markdown("**Suggested replacement**")
                            st.code(str(replacement), language=None)
                        if item.get("reason"):
                            st.write(item["reason"])
                    with right:
                        if priority.lower() == "high":
                            st.error("High priority")
                        elif priority.lower() == "low":
                            st.info("Low priority")
                        else:
                            st.warning("Medium priority")

        revised_draft = result.get("revised_draft", "")
        if revised_draft:
            st.markdown("### Optional revised draft")
            st.caption("This draft may still contain unsupported claims. Verify evidence before publishing.")
            st.text_area(
                "Review and edit the suggested draft",
                value=revised_draft,
                key="suggestion_revised_draft",
                height=220,
            )
            apply_col, download_col = st.columns(2)
            with apply_col:
                if st.button("Use draft in Create & Audit", type="primary", use_container_width=True):
                    st.session_state.editor_text = st.session_state.suggestion_revised_draft
                    st.session_state.ad_title = suggestion_record.get("title", "")
                    st.session_state.next_page = "Create & Audit"
                    st.session_state.latest_audit = None
                    st.rerun()
            with download_col:
                st.download_button(
                    "Download revised draft",
                    data=st.session_state.suggestion_revised_draft,
                    file_name="inkloom_revised_ad.txt",
                    mime="text/plain",
                    use_container_width=True,
                )

        st.info(
            "Human review required. Suggestions do not change the original audit record "
            "and do not approve or publish the advertisement."
        )


elif page == "Brand Profile":
    st.title("Brand profile")
    st.write(
        "Register a brand profile so its review terms can be used "
        "during subsequent audits."
    )

    tones = [
        "Select a tone...",
        "Professional and trustworthy",
        "Friendly and conversational",
        "Bold and energetic",
        "Clear and informative",
    ]

    
    if st.session_state.brand_tone not in tones:
        st.session_state.brand_tone = tones[0]

    with st.container(border=True):
        st.text_input(
            "Brand name",
            key="brand_name",
        )

        st.text_area(
            "Brand description",
            height=90,
            key="brand_description",
        )

        st.selectbox(
            "Preferred tone of voice",
            tones,
            key="brand_tone",
            index=0,
        )

        st.text_area(
            "Preferred terminology",
            help="Separate terms with commas.",
            key="preferred_terms",
        )

        st.text_area(
            "Terms requiring review",
            help="Separate terms with commas.",
            key="review_terms",
        )

        if st.button(
            "Save brand profile",
            type="primary",
            use_container_width=True,
        ):
            name = st.session_state.brand_name.strip()
            description = st.session_state.brand_description.strip()
            preferred_terminology = split_terms(
                st.session_state.preferred_terms
            )
            terms_requiring_review = split_terms(
                st.session_state.review_terms
            )

            if not all([
                name,
                description,
                st.session_state.brand_tone.strip() != tones[0],
                preferred_terminology,
                terms_requiring_review,
            ]):
                st.warning("Complete all five brand profile fields before saving.")
            else:
                payload = {
                    "name": name,
                    "description": description,
                    "toneOfVoice": st.session_state.brand_tone,
                    "preferredTerminology": preferred_terminology,
                    "termsRequiringReview": terms_requiring_review,
                }

              
                st.session_state.brand_profile_data = {
                    "name": payload["name"],
                    "description": payload["description"],
                    "toneOfVoice": payload["toneOfVoice"],
                    "preferredTerminology": payload["preferredTerminology"],
                    "termsRequiringReview": payload["termsRequiringReview"],
                }
                st.session_state.brand_profile_id = None
                st.session_state.brand_id = None
                st.success(
                    f"Brand profile saved locally for this session: {name}."
                )
                st.caption(
                    "Temporary test mode: this profile is kept in Streamlit "
                    "session state only. It is not saved to MongoDB and may "
                    "reset when the session restarts."
                )

    if st.session_state.get("brand_profile_data"):
        st.success(
            f"Active test brand: {st.session_state.brand_profile_data.get('name', '')}"
        )
        st.caption(
            "This profile is stored in the current Streamlit session and "
            "included in subsequent audit requests. It is not persisted to MongoDB."
        )
    elif st.session_state.brand_id:
        st.success(
            f"Active brand: {st.session_state.brand_name}"
        )
        st.caption(
            "Subsequent audits will include this brand ID in their "
            "requests."
        )
    else:
        st.info(
            "No brand profile is registered in this session. "
            "Audits will use the backend's default rules until "
            "you register a brand."
        )
