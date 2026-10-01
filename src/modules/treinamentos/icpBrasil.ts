/**
 * Padrão de assinatura digital ICP-Brasil (DOC-ICP-15.03) para PDF: PAdES com
 * a Política de Assinatura AD-RB. Dados oficiais conferidos na Lista de
 * Políticas de Assinatura (LPA_PAdES.der) publicada em politicas.icpbrasil.gov.br.
 */

/** Política em uso: PA_PAdES_AD_RB v1.3 (vigente de 23/07/2025 a 22/10/2037). */
export const ICP_POLICY = {
  name: 'PA_PAdES_AD_RB_v1_3',
  label: 'PAdES AD-RB v1.3 (ICP-Brasil)',
  oid: '2.16.76.1.7.1.11.1.3',
  /** SHA-256 do arquivo da política (igual ao publicado na LPA) */
  hashSha256Hex: '23da544aef71f7a75dc85fa6e17a83875741e4baef41ec178258a5c86ace54dd',
  uri: 'http://politicas.icpbrasil.gov.br/PA_PAdES_AD_RB_v1_3.der',
  validUntil: '2037-10-22'
};

/** Políticas PAdES da LPA (OID -> nome e hash SHA-256 do documento), para a validação. */
export const ICP_PADES_POLICIES: Record<string, { name: string; hash: string }> = {
  '2.16.76.1.7.1.11.1': { name: 'AD-RB v1.0', hash: '739a8249a24b681e4b2280e16055d254b26b684a7ac7bc0e5aca234cc0506bbd' },
  '2.16.76.1.7.1.11.1.1': { name: 'AD-RB v1.1', hash: '95752d26ca974d46675ae7fb787b606a71ea941f26b59f6b6a321f97d63b9cb1' },
  '2.16.76.1.7.1.11.1.2': { name: 'AD-RB v1.2', hash: '84ed4620c6531e4a4853adecc9e2496926c823418dd3141963ed9c4f9704a03d' },
  '2.16.76.1.7.1.11.1.3': { name: 'AD-RB v1.3', hash: '23da544aef71f7a75dc85fa6e17a83875741e4baef41ec178258a5c86ace54dd' },
  '2.16.76.1.7.1.12.1': { name: 'AD-RT v1.0', hash: '92d4f1c9cf16ae43a7e6461470b9474cc97dc9f9ff03ade6eeaf3f1ff8c11380' },
  '2.16.76.1.7.1.12.1.1': { name: 'AD-RT v1.1', hash: '953f7a202391c912216b9e84cf5dae75fe3e10e7f725fc77b60fca32fbac6426' },
  '2.16.76.1.7.1.12.1.2': { name: 'AD-RT v1.2', hash: 'da6e12c17e9be0343abbdb494723effcb53fe95f5f0b9bbee1b35bcef3a01eef' },
  '2.16.76.1.7.1.12.1.3': { name: 'AD-RT v1.3', hash: '92a972e7c292bb884e98e650773d9e9876994effb43eb36199b06bf2864a677c' }
};

/**
 * Âncoras de confiança da política AD-RB v1.3 (certificados das ACs Raiz
 * Brasileiras v5 e v12, extraídos do próprio documento oficial da política).
 */
export const ICP_TRUST_ANCHORS_B64: Record<string, string> = {
  'Autoridade Certificadora Raiz Brasileira v5':
    'MIIGoTCCBImgAwIBAgIBATANBgkqhkiG9w0BAQ0FADCBlzELMAkGA1UEBhMCQlIxEzARBgNVBAoMCklDUC1CcmFzaWwxPTA7BgNV' +
    'BAsMNEluc3RpdHV0byBOYWNpb25hbCBkZSBUZWNub2xvZ2lhIGRhIEluZm9ybWFjYW8gLSBJVEkxNDAyBgNVBAMMK0F1dG9yaWRh' +
    'ZGUgQ2VydGlmaWNhZG9yYSBSYWl6IEJyYXNpbGVpcmEgdjUwHhcNMTYwMzAyMTMwMTM4WhcNMjkwMzAyMjM1OTM4WjCBlzELMAkG' +
    'A1UEBhMCQlIxEzARBgNVBAoMCklDUC1CcmFzaWwxPTA7BgNVBAsMNEluc3RpdHV0byBOYWNpb25hbCBkZSBUZWNub2xvZ2lhIGRh' +
    'IEluZm9ybWFjYW8gLSBJVEkxNDAyBgNVBAMMK0F1dG9yaWRhZGUgQ2VydGlmaWNhZG9yYSBSYWl6IEJyYXNpbGVpcmEgdjUwggIi' +
    'MA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQD3LXgabUWsF+gUXw/6YODeF2XkqEyfk3VehdsIx+3/ERgdjCS/ouxYR0Epi2hd' +
    'oMUVJDNf3XQfjAWXJyCoTneHYAl2McMdvoqtLB2ileQlJiis0fTtYTJayee9BAIdIrCor1Lc0vozXCpDtq5nTwhjIocaZtcuFsdr' +
    'kl+nbfYxl5m7vjTkTMS6j8ffjmFzbNPDlJuV3Vy7AzapPVJrMl6UHPXCHMYMzl0KxR/47S5XGgmLYkYt8bNCHA3fg07y+Gtvgu+S' +
    'NhMPwWKIgwhYw+9vErOnavRhOimYo4M2AwNpNK0OKLI7Im5V094jFp4Ty+mlmfQH00k8nkSUEN+1TGGkhv16c2hukbx9iCfbmk7i' +
    'm2hGKjQA8eH64VPYoS2qdKbPbd3xDDHN2croYKpy2U2oQTVBSf9hC3o6fKo3zp0U3dNiw7ZgWKS9UwP31Q0gwgB1orZgLuF+LIpp' +
    'HYwxcTG/AovNWa4sTPukMiX2L+p7uIHExTZJJU4YoDacQh/mfbPIz3261He4YFmQ35sfw3eKHQSOLyiVfev/n0l/r308PijEd+d+' +
    'Hz5RmqIzS8jYXZIeJxym4mEjE1fKpeP56Ea52LlIJ8ZqsJ3xzHWu3WkAVz4hMqrX6BPMGW2IxOuEUQyIaCBg1lI6QLiPMHvo2/J7' +
    'gu4YfqRcH6i27W3HyzamEQIDAQABo4H1MIHyME4GA1UdIARHMEUwQwYFYEwBAQAwOjA4BggrBgEFBQcCARYsaHR0cDovL2FjcmFp' +
    'ei5pY3BicmFzaWwuZ292LmJyL0RQQ2FjcmFpei5wZGYwPwYDVR0fBDgwNjA0oDKgMIYuaHR0cDovL2FjcmFpei5pY3BicmFzaWwu' +
    'Z292LmJyL0xDUmFjcmFpenY1LmNybDAfBgNVHSMEGDAWgBRpqL512cTvbOcTReRhbuVo+LZAXjAdBgNVHQ4EFgQUaai+ddnE72zn' +
    'E0XkYW7laPi2QF4wDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwDQYJKoZIhvcNAQENBQADggIBABRt2/JiWapef7o/' +
    'plhR4PxymlMIp/JeZ5F0BZ1XafmYpl5g6pRokFrIRMFXLyEhlgo51I05InyCc9Td6UXjlsOASTc/LRavyjB/8NcQjlRYDh6xf7Od' +
    'P05mFcT/0+6bYRtNgsnUbr10pfsK/UzyUvQWbumGS57hCZrAZOyd9MzukiF/azAa6JfoZk2nDkEudKOY8tRyTpMmDzN5fufPSC3v' +
    '7tSJUqTqo5z7roN/FmckRzGAYyz5XulbOc5/UsAT/tk+KP/clbbqd/hhevmmdJclLr9qWZZcOgzuFU2YsgProtVu0fFNXGr6KK9f' +
    'u44pOHajmMsTXK3X7r/Pwh19kFRow5F3RQMUZC6Re0YLfXh+ypnUSCzA+uL4JPtHIGyvkbWiulkustpOKUSVwBPzvA2sQUOvqdbA' +
    'R7C8jcHYFJMuK2HZFji7pxcWWab/NKsFcJ3sluDjmhizpQaxbYTfAVXu3q8yd0su/BHHhBpteyHvYyyz0Eb9LUysR2cMtWvfPU6v' +
    'noPgYvOGO1CziyGEsgKULkCH4o2Vgl1gQuKWO4V68rFW8a/jvq28sbY+y/Ao0I5ohpnBcQOAawiFbz6yJtObajYMuztDDP8oY656' +
    'EuuJXBJhuKAJPI/7WDtgfV8ffOh/iQGQATVMtgDN0gv8bn5NdUX8UMNX1sHhU3H1UpoW',
  'Autoridade Certificadora Raiz Brasileira v12':
    'MIIGrDCCBJSgAwIBAgIJAOGP9LYdB70PMA0GCSqGSIb3DQEBDQUAMIGYMQswCQYDVQQGEwJCUjETMBEGA1UECgwKSUNQLUJyYXNp' +
    'bDE9MDsGA1UECww0SW5zdGl0dXRvIE5hY2lvbmFsIGRlIFRlY25vbG9naWEgZGEgSW5mb3JtYWNhbyAtIElUSTE1MDMGA1UEAwws' +
    'QXV0b3JpZGFkZSBDZXJ0aWZpY2Fkb3JhIFJhaXogQnJhc2lsZWlyYSB2MTIwHhcNMjQxMDIyMTQ0MTI0WhcNMzcxMDIyMTIwMDI0' +
    'WjCBmDELMAkGA1UEBhMCQlIxEzARBgNVBAoMCklDUC1CcmFzaWwxPTA7BgNVBAsMNEluc3RpdHV0byBOYWNpb25hbCBkZSBUZWNu' +
    'b2xvZ2lhIGRhIEluZm9ybWFjYW8gLSBJVEkxNTAzBgNVBAMMLEF1dG9yaWRhZGUgQ2VydGlmaWNhZG9yYSBSYWl6IEJyYXNpbGVp' +
    'cmEgdjEyMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA5PolCsI88igf+CyoE7HeF4svWLSCE/C9XO+en7Uj6J5+zYu/' +
    'G1k2kHXMvHeOrNOK67FHxXc9n/3uhqbmJYVfm77W3Ds7dIXRhDf86x7tRIQXB9biea9NAuXcgelIw1QLwi2lF3ACdaqEfN+fdYDO' +
    '6pHCK1FCEjfIld1bNSvcUB/ah4DzPjEkJPrToYo2s9J5R6NEuzBpf0HluB+Xi/9km6OSPeJPepCCNxVsnshbOpQCCAtsoSx6zxeO' +
    'WZ8WeVHWk/RZiFSNMkaJSPdlVfRkCOdvgK5nhBpLSU1giO98HDrho3FxR3mjPQ2sSda7E7fE2IqP4xTtnS4sz5Ug9bZxcVDKX58y' +
    'savZPRj2Qh+vooxbGItRRZq81XsOhutk+p0o6HgGh4JxnmpuUdhsUQayoc/Z7AsPHpe7NTiiJfkSIXJk3mGsrHrsh66n4SIEijKy' +
    'hcykDDmSbPiLPG1IO8B9awUIYMsOeVDFei95IEK6CbKhIOqTzlcgQzQ9YVXOzqzJ1Ok53RQq5CDcX0XAH/eJiWRyWqvyyLA1N9i4' +
    '6cfRF9hK/Ws/TyrM7kjp795VmjP+hnLqA4vJtx1uNApok24TUPDB6YLA1yb9ITz8qbcwJ1KvhgWZzWu5m8tZ+3X2OjFZDuSUo5Lt' +
    'yOAiEurREE50QwFlD/pOoTNNVTZ4C6Hfr3sCAwEAAaOB9jCB8zBOBgNVHSAERzBFMEMGBWBMAQEAMDowOAYIKwYBBQUHAgEWLGh0' +
    'dHA6Ly9hY3JhaXouaWNwYnJhc2lsLmdvdi5ici9EUENhY3JhaXoucGRmMEAGA1UdHwQ5MDcwNaAzoDGGL2h0dHA6Ly9hY3JhaXou' +
    'aWNwYnJhc2lsLmdvdi5ici9MQ1JhY3JhaXp2MTIuY3JsMB8GA1UdIwQYMBaAFGrBeteSwbppTtbi88KZhIm+VXQOMB0GA1UdDgQW' +
    'BBRqwXrXksG6aU7W4vPCmYSJvlV0DjAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG9w0BAQ0FAAOCAgEA' +
    'FdInyigGs5T9LIzxQp9bDaAjmyIeB/LkRHlVYVedlKGIX2lTbLEKtlc/z+/dYi9vlFxhb1xuOgDFt/Cu1lHUm/U9RVtn5HimLbYt' +
    'A7TQD5FN1Jdgf24k8zwQXTa2Rv93jD3R3JmI0/mTSXEUTgyDzPwKnxxZIi4vltJYNqBhwaVH2+aA1FZpDWlx8iB8bKGGL7yw2+0b' +
    'aEuCKuxzBKaZTZwmAHbmvFys2hrTdCr/znz4yg8613WU8ebMNYDl2OjfjBCWcpcCAsSuO+A9I+DWtxdIG9Q2DaQzXXrXrbU6cdZG' +
    'MQoPogslZIYvLOnaAalhjmNz4Yq5COBJ2cXapriMmCw+TJj/j4/SKB2EDaDzfRNY+Pea0tMHCt9bXlaSnumJT6d6ZIyQYmRnjNp+' +
    'pf6Wfg9r6yiTeldfo+QnzOqn0nRwh+ltMzMfdsyZ8CiNTf60EV4+I1pPLyZn+9nC68i4OFGYzmtO91E4/YTET2HoTIGISkcMobPd' +
    'nIBW+fU8afkcIAFEJOXdl2RzFX8DuUCHtQXVmBV5DdX04SAYIqiwUtbCnUVD344sAdY8AgjpiTR8fryJ2NmkY2srZh/RHz+VG9Fx' +
    'v4hLPdajws60RXU0Nipau8hCqDpS7mHP2IeujLbL6sxQa2iPlKWyI3ZsA+W5zVbDmNx5Lnh785pEVk8hhPg='
};
