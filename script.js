const FORM = document.getElementById("formId");
const INPUT = document.getElementById("inputId");
const TABLE = document.getElementById("tableId");
const BTN = document.getElementById("btnGozu");

let cuoCounter = 1;
let uploadedFiles = [];

FORM.addEventListener("submit", function (e) {

    e.preventDefault();

    if (INPUT.files[0] == null) return null;
    let reader = new FileReader();
    reader.readAsText(INPUT.files[0]);
    reader.onload = async function(element) {
        
        let fileContent = element.target.result;

        // Verificar si el archivo ya fue subido previamente
        if (uploadedFiles.includes(fileContent)) {
            alert("Este archivo ya ha sido subido.");
            return;
        }

        // Almacenar el contenido del archivo en el array si no es duplicado
        uploadedFiles.push(fileContent);
        
        let xmlFile = $.parseXML(element.target.result);
        let currentDate = new Date();
        currentDate = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;

        let cbcId = xmlFile.getElementsByTagName("cbc:ID")[0]?.childNodes[0]?.nodeValue || "-";
        let [Serie_comp, Número_comp] = cbcId.split('-');

        let cbcId_M = xmlFile.getElementsByTagName("cac:InvoiceDocumentReference")[0]?.getElementsByTagName("cbc:ID")[0]?.childNodes[0]?.nodeValue || "-";
        let [Serie_comp_m, Número_comp_m] = cbcId.split('-');

        // Extraer fechas del XML en formato YYYY-MM-DD
        let issueDateStr = xmlFile.getElementsByTagName("cbc:IssueDate")[0]?.childNodes[0]?.nodeValue || "-";
        let dueDateStr = xmlFile.getElementsByTagName("cbc:PaymentDueDate")[0]?.childNodes[0]?.nodeValue || "-";

        // Descomponer las fechas en año, mes y día
        let [issueYear, issueMonth, issueDay] = issueDateStr.split('-').map(Number);
        let [dueYear, dueMonth, dueDay] = dueDateStr.split('-').map(Number);

        // Calcular las diferencias
        let yearDiff = dueYear - issueYear;
        let monthDiff = dueMonth - issueMonth;
        let dayDiff = dueDay - issueDay;

        // Ajuste de diferencias si los días o meses son negativos
        if (dayDiff < 0) {
            monthDiff -= 1;
            // Sumar los días del mes anterior
            dayDiff += new Date(issueYear, issueMonth, 0).getDate();
        }

        if (monthDiff < 0) {
            yearDiff -= 1;
            monthDiff += 12;
        }

        // Formatear la diferencia en el formato "YYYY-MM-DD"
        let periodDifference = `${String(yearDiff).padStart(4, '0')}-${String(monthDiff).padStart(2, '0')}-${String(dayDiff).padStart(2, '0')}`;
        
        // Detraccion y Retencion
        const monto_total = xmlFile.getElementsByTagName("cac:LegalMonetaryTotal")[0]?.getElementsByTagName("cbc:PayableAmount")[0]?.childNodes[0]?.nodeValue
        //
        const ruc = Array.from(xmlFile.getElementsByTagName("cbc:ID")).find(id => id.getAttribute("schemeName") === "Documento de Identidad")?.childNodes[0]?.nodeValue
        let validate_detraction = false
        let validate_retention = true
        let have_retention = false
        let have_detraccion = false

        if (monto_total) {
            const igv_amount_double = parseFloat(monto_total);
            console.log(igv_amount_double)
            if (igv_amount_double > 700) {
                validate_detraction = true // tiene detraccion y no tiene retencion
                validate_retention = false
            }
        }

        // evaluamos detraccion
        if (validate_detraction) {
            console.log("Evaluamos detraccion")
            const keywords = [
                            "verificacion","planos","instalaciones","digitalizacion","planos","servicio","intermediacion laboral", "arrendamiento", "mantenimiento", "reparacion", "movimiento",
                            "comision", "fabricacion", "transporte", "contratos", "hidrobiológicos", "maiz amarillo",
                            "caña de azúcar", "arena y piedra", "residuos", "subproductos", "desechos", "recortes", 
                            "desperdicios", "bienes gravados con el igv por renuncia a la exoneración", 
                            "carnes y despojos comestibles", "aceite de pescado", 
                            "harina","polvo","pellets de pescado"," crustáceos", "moluscos", 
                            "leche", "madera", "oro gravado con el igv", "paprika", 
                            "minerales metálicos no auríferos", "plomo"
                        ];
            let items = xmlFile.getElementsByTagName("cac:Item");
            let hasDetractionKeyword = false;
            
            for (let i = 0; i < items.length; i++) {
                let description = items[i].getElementsByTagName("cbc:Description")[0]?.childNodes[0]?.nodeValue || "";
                // Convertir la descripción a minúsculas
                description = description.replace(/[.,]/g, ""); // Elimina puntos y comas
                description = description.toLowerCase(); 
                console.log("Descripción:", description); // Muestra la descripción procesada
                for (let keyword of keywords) {
                    // Convertir la palabra clave a minúsculas
                    if (description.includes(keyword.toLowerCase())) {
                        hasDetractionKeyword = true;
                        break; // Salir del bucle si se encuentra una palabra clave
                    }
                }
                if (hasDetractionKeyword){
                    have_detraccion = true; 
                    break;
                } else { validate_retention = true } // Salir si se encontró una palabra clave
            }

        }

        // evaluamos retencion
        if (validate_retention) {
            const token = "eRkC0pzcERu4dngB8g6cEfgb8mIp0519GG5S4K85kL4ioKhybAdEgbGdboi1";
            if (ruc) {
                try {
                    const response = await fetch('https://api.migo.pe/api/v1/ruc/agentes-retencion', {
                        method: 'POST',
                        headers: {
                        "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                        "token": token,
                        "ruc": ruc
                        }),
                    });
                    const dataRetention = await response.json();
                    console.log(dataRetention)
                    if (dataRetention.success) {
                        have_retention = true
                    }

                } catch (error) {
                    console.log("Ocurrio un error consultando al servicio de retencion.")
                }
            } else {
                console.log("No tiene RUC...")
            }
        }

        let data = {
            Periodo: periodDifference,
            CUO: cuoCounter.toString().padStart(4, '0'),
            Movimiento: "M3",
            Fecha_emision_comp: issueDateStr,
            Fecha_vencimiento_comp: dueDateStr,
            Tipo_comp: xmlFile.getElementsByTagName("cbc:InvoiceTypeCode")[0]?.childNodes[0]?.nodeValue || "-",
            Serie_comp: Serie_comp || "-", 
            Número_comp: Número_comp || "-",
            //------------------------------------------------------
            tipoDocProveedor: Array.from(xmlFile.getElementsByTagName("cbc:ID")).find(id => id.getAttribute("schemeName") === "Documento de Identidad")?.getAttribute("schemeID") || "-",
            numeroDocProveedor: ruc || "-",
            razonSocialProveedor: xmlFile.getElementsByTagName("cbc:RegistrationName")[0]?.childNodes[0]?.nodeValue || "-",
            baseImponibleGravadas: xmlFile.getElementsByTagName("cbc:LineExtensionAmount")[0]?.childNodes[0]?.nodeValue || "-",
            montoIGV: xmlFile.getElementsByTagName("cbc:TaxAmount")[0]?.childNodes[0]?.nodeValue || "-",
            otrosTributosCargos: xmlFile.getElementsByTagName("cbc:ChargeTotalAmount")[0]?.childNodes[0]?.nodeValue || "-",

            //------------------------------------------------------
            importe_total: monto_total || "-",
            cod_moneda: xmlFile.getElementsByTagName("cbc:DocumentCurrencyCode")[0]?.childNodes[0]?.nodeValue || "-",
            tipo_cambio: xmlFile.getElementsByTagName("cac:ExchangeRate")[0]?.getElementsByTagName("cbc:CalculationRate")[0]?.childNodes[0]?.nodeValue || "-",
            fecha_emision_comprobante_modificado: xmlFile.getElementsByTagName("cac:BillingReference")[0]?.getElementsByTagName("cbc:IssueDate")[0]?.childNodes[0]?.nodeValue || "-",
            tipo_comprobante_modificado: xmlFile.getElementsByTagName("cac:InvoiceDocumentReference")[0]?.getElementsByTagName("cbc:DocumentTypeCode")[0]?.childNodes[0]?.nodeValue || "-",
            num_serie_comprobante_modificado: Serie_comp_m || "-", 
            num_comprobante_modificado: Número_comp_m || "-",
            fecha_emision_detraccion: xmlFile.getElementsByTagName("sac:SUNATRetentionInformation")[0]?.getElementsByTagName("cbc:IssueDate")[0]?.childNodes[0]?.nodeValue || "-",
            cod_DUA_DSI:xmlFile.getElementsByTagName("sac:AdditionalInformation")[0]?.getElementsByTagName("cbc:Value")[0]?.childNodes[0]?.nodeValue || "-",
            //------------------------------------------------------
            deposit_certificate_n: (have_detraccion)? "Es sujeto a detracion" : "No Sujeto a Detraccion",
            //deposit_certificate_n: xmlFile.getElementsByTagName("cac:PayeeFinancialAccount")[0]?.childNodes[0]?.childNodes[0]?.nodeValue || "No Sujeto a Detraccion",
            hasRetention: (have_retention) ? "Es sujeto a Retencion" : "No es sujeto a Retencion",

        //     reference: xmlFile.getElementsByTagName("cbc:ID")[0]?.childNodes[0]?.nodeValue || "null",
        //     currentDate: currentDate,
        //     issueDate: xmlFile.getElementsByTagName("cbc:IssueDate")[0]?.childNodes[0]?.nodeValue || "null",
        //     taxAmount: xmlFile.getElementsByTagName("cbc:TaxAmount")[0]?.childNodes[0]?.nodeValue || "null",
        //     taxableAmount: xmlFile.getElementsByTagName("cbc:TaxableAmount")[0]?.childNodes[0]?.nodeValue || "null",
        //     payableAmount: parseFloat(xmlFile.getElementsByTagName("cbc:PayableAmount")[0]?.childNodes[0]?.nodeValue) || 0,
        //     description: xmlFile.getElementsByTagName("cbc:Description")[0]?.childNodes[0]?.nodeValue || "null",
        //     t_documento_emi: xmlFile.getElementsByTagName("cbc:RegistrationName")[0]?.childNodes[0]?.nodeValue || "null",

        //     ubl: xmlFile.getElementsByTagName("cbc:UBLVersionID")[0]?.childNodes[0]?.nodeValue || "null",
        //     V_estruc: xmlFile.getElementsByTagName("cbc:CustomizationID")[0]?.childNodes[0]?.nodeValue || "null",
        //     time_emi: xmlFile.getElementsByTagName("cbc:IssueTime")[0]?.childNodes[0]?.nodeValue || "null",
        //     Cod_docu: xmlFile.getElementsByTagName("cbc:InvoiceTypeCode")[0]?.childNodes[0]?.nodeValue || "null",
        //     leyenda: xmlFile.getElementsByTagName('cbc:Note')[0]?.childNodes[0]?.nodeValue || "null",
        //     Tp_mond: xmlFile.getElementsByTagName("cbc:DocumentCurrencyCode")[0]?.childNodes[0]?.nodeValue || "null",
        //     num_items: xmlFile.getElementsByTagName("cbc:LineCountNumeric")[0]?.childNodes[0]?.nodeValue || "null",
        //     Ruc: xmlFile.getElementsByTagName("cbc:ID")[2]?.childNodes[0]?.nodeValue || "null",
        //     cod_dom_fiscal: xmlFile.getElementsByTagName("cbc:AddressTypeCode")[0]?.childNodes[0]?.nodeValue || "null",
        //     name_adquiriente: xmlFile.getElementsByTagName("cbc:RegistrationName")[1]?.childNodes[0]?.nodeValue || "null",

        //    ruc_adquitiente: xmlFile.getElementsByTagName("cac:AccountingCustomerParty")[0]?.getElementsByTagName("cbc:ID")[0]?.childNodes[0]?.nodeValue || "null",
            
        //    Direc_adquiriente: xmlFile.getElementsByTagName("cbc:Line")[1]?.childNodes[0]?.nodeValue || "null",
        //     Direc_empresa: xmlFile.getElementsByTagName("cbc:Line")[0]?.childNodes[0]?.nodeValue || "null",
        //     cod_dom_fiscal_adquiriente: xmlFile.getElementsByTagName("cbc:AddressTypeCode")[1]?.childNodes[0]?.nodeValue || "null",

        //     // Nuevo campo para la condición de detracción o retención
        //     status: "no está sujeto a nada" // Valor predeterminado


        };
        //DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
        // Verificar condiciones para detracción o retención
        // let igvAmount = Array.from(xmlFile.getElementsByTagName("cbc:Name")).some(nameNode => nameNode.childNodes[0]?.nodeValue === "IGV");
        // if (data.payableAmount > 700 && igvAmount) {
        //     // Verificar si alguna descripción contiene las palabras clave
        //     const keywords = [
        //         "digitalizacion","planos","servicio","intermediacion laboral", "arrendamiento", "mantenimiento", "reparacion", "movimiento",
        //         "comision", "fabricacion", "transporte", "contratos", "hidrobiológicos", "maiz amarillo",
        //         "caña de azúcar", "arena y piedra", "residuos", "subproductos", "desechos", "recortes", 
        //         "desperdicios", "bienes gravados con el igv por renuncia a la exoneración", 
        //         "carnes y despojos comestibles", "aceite de pescado", 
        //         "harina","polvo","pellets de pescado"," crustáceos", "moluscos", 
        //         "leche", "madera", "oro gravado con el igv", "paprika", 
        //         "minerales metálicos no auríferos", "oro", "plomo"
        //     ];
            
        //     let items = xmlFile.getElementsByTagName("cac:Item");
        //     let hasDetractionKeyword = false;
            
        //     for (let i = 0; i < items.length; i++) {
        //         let description = items[i].getElementsByTagName("cbc:Description")[0]?.childNodes[0]?.nodeValue || "";
        //         // Convertir la descripción a minúsculas
        //         description = description.toLowerCase(); 
        //         for (let keyword of keywords) {
        //             // Convertir la palabra clave a minúsculas
        //             if (description.includes(keyword.toLowerCase())) {
        //                 hasDetractionKeyword = true;
        //                 break; // Salir del bucle si se encuentra una palabra clave
        //             }
        //         }
        //         if (hasDetractionKeyword) break; // Salir si se encontró una palabra clave
        //     }

        //     // Establecer el estado según los resultados
        //     if (hasDetractionKeyword) {
        //         data.status = "sujeto a detracción";
        //     } else {
        //         data.status = "sujeto a retención";
        //     }
        // }
        //DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
        // Insertar los datos en la tabla
        let cellIndex = 0;
        let row = TABLE.insertRow(1);
        for (const key in data) {
            let cell = row.insertCell(cellIndex);
            cell.innerHTML = "" + data[key];
            cellIndex++;
        }

        BTN.style.display = "block";
    };
});

BTN.addEventListener("click", function(){
    let result = [];
    let rowsQuantity = TABLE.rows.length;
    if (rowsQuantity > 1) for (let i = 0; i < rowsQuantity; i++) {
        let rowTemp = [];
        for (let j = 0; j < 26; j++) {
            rowTemp.push(TABLE.rows[i].cells[j].innerHTML);
        }
        result.push(rowTemp);
    }

    console.log(result);
    console.log(TABLE.outerHTML);

    let book = XLSX.utils.book_new();
    book.SheetNames.push("Sheet 1");
    let sheet = XLSX.utils.aoa_to_sheet(result);
    sheet["A1"].s = { font: { sz: 14, bold: true, color: { rgb: "FFFFAA00" } }, fill: { bgColor: { indexed: 64 }, fgColor: { rgb: "FFFF00" } } ,border: { top: { style: 'medium', color: { rgb: "FFFFAA00"}}, left: { style: 'medium', color: { rgb: "FFFFAA00"}}}};
    book.Sheets['Sheet 1'] = sheet; 
    let xlsxFile = XLSX.write(book, {bookType:'xlsx',  type: 'binary'});
    let arrayBuffer = new ArrayBuffer(xlsxFile.length);
    let uint8array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < xlsxFile.length; i++) uint8array[i] = xlsxFile.charCodeAt(i) & 0xff;
    saveAs(
        new Blob([arrayBuffer], { type: "application/octet-stream" }),"result.xlsx"
    );
    // let downloadLink = document.createElement("a");
    // downloadLink.href = 'data:' + 'application/vnd.ms-excel' + ', ' + TABLE.outerHTML.replace(/ /g, '%20');
    // downloadLink.download = 'data.xls';
    // downloadLink.click();
}); 