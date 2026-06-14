async function loadQueries() {

    let user =
        JSON.parse(localStorage.getItem("user"));

    let queries =
        await apiGet(
        `/queries?department_id=${user.department_id}`
        );

    let html = "";

    queries.forEach(q => {

        html += `
        <div class="query-card">
            <h4>${q.title}</h4>
            <p>${q.body}</p>
            <span>${q.status}</span>
        </div>`;
    });

    document.getElementById("queryList")
        .innerHTML = html;
}

async function createQuery() {

    let user =
        JSON.parse(localStorage.getItem("user"));

    await apiPost("/queries", {

        department_id: user.department_id,
        posted_by: user.user_id,

        title:
        document.getElementById("title").value,

        body:
        document.getElementById("body").value
    });

    loadQueries();
}
