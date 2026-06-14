window.onload = loadDashboard;

async function loadDashboard() {

    let user =
        JSON.parse(localStorage.getItem("user"));

    let stats =
        await apiGet(
        `/dashboard/stats?department_id=${user.department_id}&user_id=${user.user_id}&role=${user.role}`
        );

    document.getElementById("manuals")
        .innerText = stats.library.manuals;

    document.getElementById("videos")
        .innerText = stats.library.videos;

    document.getElementById("queries")
        .innerText = stats.queries.total;

    document.getElementById("faqs")
        .innerText = stats.faqs;
}
