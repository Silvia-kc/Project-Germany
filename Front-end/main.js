const brandSelect = document.getElementById("brand")
const modelSelect = document.getElementById("model")
const infoDiv = document.getElementById("info");
let carsData = {};
fetch("cars.json")
   .then((response) => response.json())
   .then((data) => {
    carsData = data
    populateBrands()
})
function populateBrands(){
    Object.keys(carsData).forEach((brand) => {
        const option = document.createElement("option")
        option.value = brand
        option.textContent = brand
        brandSelect.appendChild(option)
    })
}

brandSelect.addEventListener("change", function () {
    const selectedBrand = this.value;
    modelSelect.innerHTML = '<option value="">-- Select a model --</option>';
    infoDiv.innerHTML = "";

    if (selectedBrand && carsData[selectedBrand]) {
        Object.keys(carsData[selectedBrand]).forEach((model) => {
        const option = document.createElement("option");
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
        });
    }
});

modelSelect.addEventListener("change", function () {
    const brand = brandSelect.value;
    const model = this.value;

    if (brand && model && carsData[brand][model]) {
        const details = carsData[brand][model];

        infoDiv.innerHTML = `
        <h3>${brand} ${model}</h3>
        <ul>
            <li><strong>Year:</strong> ${details.year}</li>
            <li><strong>Engine:</strong> ${details.engine}</li>
            <li><strong>Horsepower:</strong> ${details.horsePower} HP</li>
            <li><strong>Gearbox:</strong> ${details.gearbox}</li>
            <li><strong>Price:</strong> €${details.price.toLocaleString()}</li>
            </ul>
            <img src="${details.image}">
        `;
    } else {
        infoDiv.innerHTML = "";
    }
});