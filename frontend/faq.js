async function loadFaqs() {

    let user =
        JSON.parse(localStorage.getItem("user"));

    let faqs =
        await apiGet(
        `/faqs?department_id=${user.department_id}`
        );

    let html = "";

    faqs.forEach(faq => {

        html += `
        <div>
            <h3>${faq.question}</h3>
            <p>${faq.answer}</p>
        </div>`;
    });

    document.getElementById("faqList")
        .innerHTML = html;
}

window.onload = loadFaqs;
