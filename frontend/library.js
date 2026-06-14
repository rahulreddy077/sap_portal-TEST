async function loadLibrary() {

    let user =
        JSON.parse(localStorage.getItem("user"));

    let items =
        await apiGet(
        `/library?department_id=${user.department_id}`
        );

    let html = "";

    items.forEach(item => {

        html += `
        <tr>
            <td>${item.title}</td>
            <td>${item.item_type}</td>
            <td>${item.version}</td>
        </tr>`;
    });

    document.getElementById("libraryBody")
        .innerHTML = html;
}

window.onload = loadLibrary;
