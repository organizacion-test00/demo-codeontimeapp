<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns="http://schemas.microsoft.com/sqlserver/reporting/2008/01/reportdefinition"
    xmlns:rd="http://schemas.microsoft.com/SQLServer/reporting/reportdesigner"
    xmlns:msxsl="urn:schemas-microsoft-com:xslt"
    xmlns:a="urn:schemas-codeontime-com:data-aquarium"
    exclude-result-prefixes="msxsl a"
>
  <xsl:output method="xml" indent="yes"/>
  <xsl:param name="ControllerName" select="/a:dataController/@name"/>
  <xsl:param name="ViewName" select="'grid1'"/>
  <xsl:variable name="DefaultFieldColumns" select="30"/>
  <xsl:variable name="MinimumFieldColumns" select="16"/>
  <xsl:variable name="View" select="//a:dataController[@name=$ControllerName]/a:views/a:view[@id=$ViewName]/self::*[1]"/>
  <xsl:variable name="FontSize">
    <xsl:choose>
      <xsl:when test="$View/@reportFont='X-Large'">12</xsl:when>
      <xsl:when test="$View/@reportFont='Large'">10</xsl:when>
      <xsl:when test="$View/@reportFont='Medium'">8</xsl:when>
      <xsl:when test="$View/@reportFont='Small'">7</xsl:when>
      <xsl:when test="$View/@reportFont='X-Small'">6</xsl:when>
      <xsl:otherwise>8</xsl:otherwise>
    </xsl:choose>
    <xsl:text>pt</xsl:text>
  </xsl:variable>
  <xsl:variable name="ElementHeight">
    <xsl:choose>
      <xsl:when test="$View/@reportFont='X-Large'">0.3</xsl:when>
      <xsl:when test="$View/@reportFont='Large'">0.25</xsl:when>
      <xsl:when test="$View/@reportFont='Medium'">0.2</xsl:when>
      <xsl:when test="$View/@reportFont='Small'">0.185</xsl:when>
      <xsl:when test="$View/@reportFont='X-Small'">0.17</xsl:when>
      <xsl:otherwise>0.2</xsl:otherwise>
    </xsl:choose>
  </xsl:variable>

  <xsl:variable name="ElementHeightDelta">
    <xsl:choose>
      <xsl:when test="$View/@type!='Form' and $View/a:dataFields/a:dataField[@fieldName=$View/ancestor::a:dataController/a:fields/a:field[@onDemand='true' and @onDemandStyle!='']/@name]">
        <xsl:choose>
          <xsl:when test="$View/@reportFont='X-Large'">0.7</xsl:when>
          <xsl:when test="$View/@reportFont='Large'">0.75</xsl:when>
          <xsl:when test="$View/@reportFont='Medium'">0.8</xsl:when>
          <xsl:when test="$View/@reportFont='Small'">0.815</xsl:when>
          <xsl:when test="$View/@reportFont='X-Small'">0.73</xsl:when>
          <xsl:otherwise>0.8</xsl:otherwise>
        </xsl:choose>
      </xsl:when>
      <xsl:otherwise>0</xsl:otherwise>
    </xsl:choose>
  </xsl:variable>

  <xsl:template match="a:dataController">
    <xsl:comment>
      <xsl:value-of select="$ViewName"/>
      <xsl:text> - </xsl:text>
      <xsl:value-of select="count($View)"/>
      <xsl:text> - </xsl:text>
      <xsl:value-of select="$View/@id"/>
      <xsl:text>:</xsl:text>
      <xsl:value-of select="$View/@reportFont"/>
    </xsl:comment>
    <xsl:variable name="Self" select="."/>
    <xsl:variable name="Fields" select="a:fields/a:field[(not(@onDemand='true') or @onDemandStyle!='') and @type!='DataView']"/>
    <xsl:variable name="DataFields" select="$View//a:dataField[@fieldName=$Fields/@name and not(@hidden='true')]"/>
    <xsl:variable name="AggregateFields" select="a:views/a:view[@id=$ViewName][1]//a:dataField[@fieldName=$Fields/@name and not(@hidden='true') and @aggregate!='']"/>
    <xsl:variable name="PortraitReportMaxFieldCount">
      <xsl:choose>
        <xsl:when test="$View/@reportOrientation='Portrait'">
          <xsl:value-of select="1000"/>
        </xsl:when>
        <xsl:when test="$View/@reportOrientation='Landscape'">
          <xsl:value-of select="1"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="8"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="ReportWidth">
      <xsl:choose>
        <xsl:when test="$View/@reportOrientation='Portrait'">
          <xsl:value-of select="7.5"/>
        </xsl:when>
        <xsl:when test="$View/@reportOrientation='Landscape'">
          <xsl:value-of select="10"/>
        </xsl:when>
        <xsl:when test="$View/@type='Form' or $View/@type='Chart'">
          <xsl:value-of select="7.5"/>
        </xsl:when>
        <xsl:when test="count($DataFields)&gt;$PortraitReportMaxFieldCount">
          <xsl:value-of select="10"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="7.5"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="ReportHeight">
      <xsl:choose>
        <xsl:when test="$View/@reportOrientation='Portrait'">
          <xsl:value-of select="10"/>
        </xsl:when>
        <xsl:when test="$View/@reportOrientation='Landscape'">
          <xsl:value-of select="7.5"/>
        </xsl:when>
        <xsl:when test="$View/@type='Form' or $View/@type='Chart'">
          <xsl:value-of select="10"/>
        </xsl:when>
        <xsl:when test="count($DataFields)&gt;$PortraitReportMaxFieldCount">
          <xsl:value-of select="7.5"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="10"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:comment>
      If you can see this message, you need to install the correct version of SQL Reporting Services
      Microsoft Rdlc Report Designer for Visual Studio 2017: https://marketplace.visualstudio.com/items?itemName=ProBITools.MicrosoftRdlcReportDesignerforVisualStudio-18001
      Microsoft Visual Studio 2015 Sql Server Data Tools (SSDT): https://docs.microsoft.com/en-us/sql/ssdt/download-sql-server-data-tools-ssdt
    </xsl:comment>
    <Report>
      <DataSources>
        <DataSource Name="{$Self/@name}DataSource">
          <rd:DataSourceID>0e04e19a-b1dd-4ad1-bd43-174d0d295397</rd:DataSourceID>
          <ConnectionProperties>
            <DataProvider>OLEDB</DataProvider>
            <ConnectString />
          </ConnectionProperties>
        </DataSource>
      </DataSources>
      <DataSets>
        <DataSet Name="{@name}">
          <Fields>
            <xsl:for-each select="$Fields[not(@onDemand='true')]">
              <Field Name="{@name}">
                <DataField>
                  <xsl:value-of select="@name"/>
                </DataField>
                <rd:TypeName>
                  <xsl:text>System.</xsl:text>
                  <xsl:value-of select="@type"/>
                </rd:TypeName>
              </Field>
            </xsl:for-each>
          </Fields>
          <Query>
            <DataSourceName>
              <xsl:value-of select="$Self/@name"/>
              <xsl:text>DataSource</xsl:text>
            </DataSourceName>
            <CommandText />
          </Query>
        </DataSet>
      </DataSets>
      <Body>
        <ReportItems>
          <Textbox Name="FilterDetailsTextbox">
            <CanGrow>true</CanGrow>
            <CanShrink>true</CanShrink>
            <KeepTogether>true</KeepTogether>
            <Paragraphs>
              <Paragraph>
                <TextRuns>
                  <TextRun>
                    <Value>=Parameters!FilterDetails.Value</Value>
                    <Style>
                      <FontStyle>Italic</FontStyle>
                      <FontSize>8pt</FontSize>
                      <Color>Navy</Color>
                    </Style>
                  </TextRun>
                </TextRuns>
                <Style>
                  <TextAlign>Center</TextAlign>
                </Style>
              </Paragraph>
            </Paragraphs>
            <Left>0.0in</Left>
            <Height>
              <xsl:text>0.25in</xsl:text>
            </Height>
            <Width>
              <xsl:value-of select="$ReportWidth"/>
              <xsl:text>in</xsl:text>
            </Width>
            <ZIndex>1</ZIndex>
            <Visibility>
              <Hidden>=String.IsNullOrEmpty(Parameters!FilterDetails.Value)</Hidden>
            </Visibility>
            <Style>
              <BottomBorder>
                <Style>=IIf(String.IsNullOrEmpty(Parameters!FilterDetails.Value), "", "Solid")</Style>
              </BottomBorder>
              <PaddingLeft>2pt</PaddingLeft>
              <PaddingRight>2pt</PaddingRight>
              <PaddingTop>2pt</PaddingTop>
              <PaddingBottom>5pt</PaddingBottom>
            </Style>
          </Textbox>
          <xsl:choose>
            <xsl:when test="$View/@type='Chart'">
              <Image Name="{$View/@id}Image">
                <Source>External</Source>
                <!-- =CStr(Parameters!BaseUrl) & "/ChartHost.aspx?c=SalesbyCategory_chart1&w=720&r=" & CStr(Parameters!Query)-->
                <Value>
                  <xsl:text>=CStr(Parameters!BaseUrl.Value)</xsl:text>
                  <xsl:text> &amp; "/ChartHost.aspx?c=</xsl:text>
                  <xsl:value-of select="$Self/@name"/>
                  <xsl:text>_</xsl:text>
                  <xsl:value-of select="$View/@id"/>
                  <xsl:text>&amp;w=</xsl:text>
                  <xsl:choose>
                    <xsl:when test="$ReportWidth = 10">
                      <xsl:text>910</xsl:text>
                    </xsl:when>
                    <xsl:otherwise>720</xsl:otherwise>
                  </xsl:choose>
                  <xsl:text>&amp;r=" &amp; CStr(Parameters!Query.Value)</xsl:text>
                </Value>
                <Top>0.25in</Top>
                <Left>0in</Left>
                <Height>0.75in</Height>
                <Width>
                  <xsl:value-of select="$ReportWidth"/>
                  <xsl:text>in</xsl:text>
                </Width>
                <Style>
                  <Border>
                    <Style>None</Style>
                  </Border>
                  <PaddingBottom>2pt</PaddingBottom>
                </Style>
              </Image>
            </xsl:when>
            <xsl:otherwise>
              <Tablix Name="Tablix1">
                <xsl:choose>
                  <xsl:when test="$View/@type='Form'">
                    <xsl:call-template name="RenderFormTablixBody">
                      <xsl:with-param name="DataFields" select="$DataFields"/>
                      <xsl:with-param name="Fields" select="$Fields"/>
                      <xsl:with-param name="AggregateFields" select="$AggregateFields"/>
                      <xsl:with-param name="ReportWidth" select="$ReportWidth"/>
                    </xsl:call-template>
                  </xsl:when>
                  <xsl:otherwise>
                    <xsl:call-template name="RenderGridTablixBody">
                      <xsl:with-param name="DataFields" select="$DataFields"/>
                      <xsl:with-param name="Fields" select="$Fields"/>
                      <xsl:with-param name="AggregateFields" select="$AggregateFields"/>
                      <xsl:with-param name="ReportWidth" select="$ReportWidth"/>
                    </xsl:call-template>
                  </xsl:otherwise>
                </xsl:choose>
                <DataSetName>
                  <xsl:value-of select="@name"/>
                </DataSetName>
                <Top>0.25in</Top>
                <Left>0.0in</Left>
                <Height>
                  <xsl:choose>
                    <xsl:when test="$View/@type='Form'">
                      <xsl:value-of select="$ElementHeight * count($DataFields)"/>
                    </xsl:when>
                    <xsl:when test="$AggregateFields">
                      <xsl:value-of select="$ElementHeight *3 + 0.05"/>
                    </xsl:when>
                    <xsl:otherwise>
                      <xsl:value-of select="$ElementHeight * 2 + $ElementHeightDelta"/>
                    </xsl:otherwise>
                  </xsl:choose>
                  <xsl:text>in</xsl:text>
                </Height>
                <Width>
                  <xsl:value-of select="$ReportWidth"/>
                  <xsl:text>in</xsl:text>
                </Width>
                <Style>
                  <BottomBorder>
                    <Style>Solid</Style>
                    <Width>0.5pt</Width>
                    <Color>
                      <xsl:choose>
                        <xsl:when test="$AggregateFields">Black</xsl:when>
                        <xsl:otherwise>Silver</xsl:otherwise>
                      </xsl:choose>
                    </Color>
                  </BottomBorder>
                </Style>
              </Tablix>
            </xsl:otherwise>
          </xsl:choose>
        </ReportItems>
        <Height>
          <xsl:choose>
            <xsl:when test="$View/@type='Form'">
              <xsl:value-of select="$ElementHeight * count($DataFields) + 0.25"/>
            </xsl:when>
            <xsl:when test="$View/@type='Chart'">
              <xsl:text>1</xsl:text>
            </xsl:when>
            <xsl:when test="$AggregateFields">
              <xsl:value-of select="$ElementHeight * 3 + 0.25"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="$ElementHeight * 2 + 0.25 + $ElementHeightDelta"/>
            </xsl:otherwise>
          </xsl:choose>
          <xsl:text>in</xsl:text>
        </Height>
      </Body>
      <ReportParameters>
        <ReportParameter Name="FilterDetails">
          <DataType>String</DataType>
          <DefaultValue>
            <Values>
              <Value>=String.Empty</Value>
            </Values>
          </DefaultValue>
          <AllowBlank>true</AllowBlank>
          <Prompt>Filter Details</Prompt>
          <Hidden>true</Hidden>
        </ReportParameter>
        <ReportParameter Name="BaseUrl">
          <DataType>String</DataType>
          <DefaultValue>
            <Values>
              <!-- ="http://localhost:28765/Reporting" -->
              <Value>=String.Empty</Value>
            </Values>
          </DefaultValue>
          <AllowBlank>true</AllowBlank>
          <Prompt>Base Url</Prompt>
          <Hidden>true</Hidden>
        </ReportParameter>
        <ReportParameter Name="Query">
          <DataType>String</DataType>
          <DefaultValue>
            <Values>
              <Value>=String.Empty</Value>
            </Values>
          </DefaultValue>
          <AllowBlank>true</AllowBlank>
          <Prompt>Filter Details</Prompt>
          <Hidden>true</Hidden>
        </ReportParameter>
      </ReportParameters>
      <xsl:if test="$Fields/a:items/a:item">
        <Code>
          <![CDATA[
            Public Function ValueToText(ByVal value As Object, ByVal ParamArray items() As String) As String
                Dim i As Integer = 0
                While (i < items.Length)
                    If Not (value Is Nothing) Then
                        If Convert.ToString(value).Equals(items(i), StringComparison.CurrentCultureIgnoreCase) Then
                            Return items(i + 1)
                        End If
                    Else
                        If String.IsNullOrEmpty(items(i)) Then
                            Return items(i + 1)
                        End If
                    End If
                    i = i + 2
                End While
                Return String.Empty
            End Function
]]>
        </Code>
      </xsl:if>
      <rd:DrawGrid>false</rd:DrawGrid>
      <rd:SnapToGrid>false</rd:SnapToGrid>
      <Page>
        <PageHeader>
          <Height>0.375in</Height>
          <PrintOnFirstPage>true</PrintOnFirstPage>
          <PrintOnLastPage>true</PrintOnLastPage>
          <ReportItems>
            <Textbox Name="ReportTitleTextbox">
              <CanGrow>true</CanGrow>
              <Paragraphs>
                <Paragraph>
                  <TextRuns>
                    <TextRun>
                      <Value>
                        <xsl:choose>
                          <xsl:when test="$View/@reportLabel!=''">
                            <xsl:value-of select="$View/@reportLabel"/>
                          </xsl:when>
                          <xsl:otherwise>
                            <xsl:value-of select="$View/@label"/>
                          </xsl:otherwise>
                        </xsl:choose>
                      </Value>
                      <Style>
                        <FontSize>18pt</FontSize>
                        <Color>Black</Color>
                      </Style>
                    </TextRun>
                  </TextRuns>
                  <Style>
                    <TextAlign>Center</TextAlign>
                  </Style>
                </Paragraph>
              </Paragraphs>
              <rd:DefaultName>textbox5</rd:DefaultName>
              <Top>0.0in</Top>
              <Height>0.375in</Height>
              <Width>
                <xsl:value-of select="$ReportWidth"/>
                <xsl:text>in</xsl:text>
              </Width>
              <Style>
                <PaddingLeft>2pt</PaddingLeft>
                <PaddingRight>2pt</PaddingRight>
                <PaddingTop>2pt</PaddingTop>
                <PaddingBottom>2pt</PaddingBottom>
              </Style>
            </Textbox>
          </ReportItems>
          <Style>
            <Border>
              <Style>None</Style>
              <Width>1pt</Width>
            </Border>
            <BottomBorder>
              <Style>None</Style>
            </BottomBorder>
          </Style>
        </PageHeader>
        <PageFooter>
          <PrintOnFirstPage>true</PrintOnFirstPage>
          <ReportItems>
            <Textbox Name="FooterPrintedInfoTextBox">
              <rd:DefaultName>textbox7</rd:DefaultName>
              <Width>3.125in</Width>
              <Top>0in</Top>
              <Style>
                <VerticalAlign>Bottom</VerticalAlign>
                <PaddingLeft>2pt</PaddingLeft>
                <PaddingRight>2pt</PaddingRight>
                <PaddingTop>2pt</PaddingTop>
                <PaddingBottom>2pt</PaddingBottom>
              </Style>
              <ZIndex>1</ZIndex>
              <CanGrow>true</CanGrow>
              <Paragraphs>
                <Paragraph>
                  <TextRuns>
                    <TextRun>
                      <Value>
                        <xsl:text>="^PrintedOn^Printed on^PrintedOn^ " &amp; CStr(Now())</xsl:text>
                        <xsl:text> &amp; IIf(CountRows("</xsl:text>
                        <xsl:value-of select="@name"/>
                        <xsl:text>") > 1, " (" &amp; CountRows("</xsl:text>
                        <xsl:value-of select="@name"/>
                        <xsl:text>") &amp; " ^Items^items^Items^)", "")</xsl:text>
                      </Value>
                      <Style>
                        <FontStyle>Italic</FontStyle>
                        <FontSize>8pt</FontSize>
                      </Style>
                    </TextRun>
                  </TextRuns>
                  <Style />
                </Paragraph>
              </Paragraphs>
            </Textbox>
            <Textbox Name="FooterPageNumberTextBox">
              <rd:DefaultName>textbox6</rd:DefaultName>
              <Style>
                <PaddingLeft>2pt</PaddingLeft>
                <PaddingRight>2pt</PaddingRight>
                <PaddingTop>2pt</PaddingTop>
                <PaddingBottom>2pt</PaddingBottom>
              </Style>
              <ZIndex>1</ZIndex>
              <CanGrow>true</CanGrow>
              <Left>6in</Left>
              <Top>0in</Top>
              <Paragraphs>
                <Paragraph>
                  <TextRuns>
                    <TextRun>
                      <Value>="^Page^Page^Page^ " &amp; CStr(Globals!PageNumber) &amp; " ^of^of^of^ " &amp; CStr(Globals!TotalPages)</Value>
                    </TextRun>
                  </TextRuns>
                  <Style>
                    <TextAlign>Right</TextAlign>
                  </Style>
                </Paragraph>
              </Paragraphs>
            </Textbox>
          </ReportItems>
          <Height>0.25in</Height>
          <PrintOnLastPage>true</PrintOnLastPage>
        </PageFooter>
        <RightMargin>0.5in</RightMargin>
        <LeftMargin>0.5in</LeftMargin>
        <BottomMargin>0.5in</BottomMargin>
        <TopMargin>0.5in</TopMargin>
        <rd:ReportID>9168933f-7fe4-4dac-89eb-8714804b3c85</rd:ReportID>
        <PageWidth>
          <xsl:value-of select="concat($ReportWidth + 1, 'in')"/>
        </PageWidth>
        <PageHeight>
          <xsl:value-of select="concat($ReportHeight + 1, 'in')"/>
        </PageHeight>
      </Page>
      <Width>
        <xsl:value-of select="concat($ReportWidth,'in')"/>
      </Width>
      <Language>en-US</Language>
    </Report>
  </xsl:template>

  <xsl:template name="RenderFormTablixBody">
    <xsl:param name="DataFields"/>
    <xsl:param name="Fields"/>
    <xsl:param name="ReportWidth"/>
    <xsl:param name="AggregateFields"/>
    <TablixBody>
      <TablixColumns>
        <TablixColumn>
          <Width>7.5in</Width>
        </TablixColumn>
      </TablixColumns>
      <TablixRows>
        <TablixRow>
          <Height>
            <xsl:value-of select="$ElementHeight*count($DataFields)"/>
            <xsl:text>in</xsl:text>
          </Height>
          <TablixCells>
            <TablixCell>
              <CellContents>
                <Rectangle Name="Rectangle1">
                  <ReportItems>
                    <xsl:for-each select="$DataFields">
                      <xsl:variable name="Field" select="$Fields[(current()/@aliasFieldName and @name = current()/@aliasFieldName) or (not(current()/@aliasFieldName) and current()/@fieldName = @name)]"/>
                      <Textbox Name="{@fieldName}HeaderTextBox">
                        <CanGrow>true</CanGrow>
                        <KeepTogether>true</KeepTogether>
                        <Paragraphs>
                          <Paragraph>
                            <TextRuns>
                              <TextRun>
                                <Value>
                                  <xsl:choose>
                                    <xsl:when test="a:headerText!=''">
                                      <xsl:value-of select="a:headerText"/>
                                    </xsl:when>
                                    <xsl:otherwise>
                                      <xsl:value-of select="$Field/@label"/>
                                    </xsl:otherwise>
                                  </xsl:choose>
                                </Value>
                                <Style>
                                  <FontSize>
                                    <xsl:value-of select="$FontSize"/>
                                  </FontSize>
                                  <FontWeight>Bold</FontWeight>
                                </Style>
                              </TextRun>
                            </TextRuns>
                            <Style />
                          </Paragraph>
                        </Paragraphs>
                        <rd:DefaultName>Textbox6</rd:DefaultName>
                        <Left>0.0in</Left>
                        <Top>
                          <xsl:value-of select="(position() - 1) * $ElementHeight"/>
                          <xsl:text>in</xsl:text>
                        </Top>
                        <Height>
                          <xsl:value-of select="$ElementHeight"/>
                          <xsl:text>in</xsl:text>
                        </Height>
                        <Width>1.5in</Width>
                        <Style>
                          <xsl:call-template name="RenderFormFieldAttributes"/>
                        </Style>
                      </Textbox>
                      <Textbox Name="{@fieldName}DataTextBox">
                        <xsl:choose>
                          <xsl:when test="$Field/@onDemand='true'">
                            <CanGrow>false</CanGrow>
                          </xsl:when>
                          <xsl:otherwise>
                            <CanGrow>true</CanGrow>
                          </xsl:otherwise>
                        </xsl:choose>
                        <KeepTogether>true</KeepTogether>
                        <Paragraphs>
                          <Paragraph>
                            <TextRuns>
                              <TextRun>
                                <xsl:call-template name="RenderFieldTextRunValue">
                                  <xsl:with-param name="Field" select="$Field"/>
                                </xsl:call-template>
                                <Style>
                                  <FontSize>
                                    <xsl:value-of select="$FontSize"/>
                                  </FontSize>
                                  <FontWeight>Normal</FontWeight>
                                </Style>
                              </TextRun>
                            </TextRuns>
                            <Style>
                              <TextAlign>Left</TextAlign>
                            </Style>
                          </Paragraph>
                        </Paragraphs>
                        <Top>
                          <xsl:value-of select="(position() - 1) * $ElementHeight"/>
                          <xsl:text>in</xsl:text>
                        </Top>
                        <Left>1.5in</Left>
                        <Height>
                          <xsl:choose>
                            <xsl:when test="$Field/@onDemand='true'">
                              <xsl:text>0.02in</xsl:text>
                            </xsl:when>
                            <xsl:otherwise>
                              <xsl:value-of select="$ElementHeight"/>
                              <xsl:text>in</xsl:text>
                            </xsl:otherwise>
                          </xsl:choose>
                        </Height>
                        <Width>
                          <xsl:value-of select="$ReportWidth - 1.5"/>
                          <xsl:text>in</xsl:text>
                        </Width>
                        <ZIndex>1</ZIndex>
                        <Style>
                          <xsl:call-template name="RenderFormFieldAttributes"/>
                        </Style>
                      </Textbox>
                      <xsl:if test="$Field/@onDemand='true'">
                        <Image Name="{$Field/@name}Image">
                          <xsl:call-template name="RenderImageValue">
                            <xsl:with-param name="Field" select="$Field"/>
                          </xsl:call-template>
                          <Top>
                            <xsl:value-of select="(position() - 1) * $ElementHeight + 0.02"/>
                            <xsl:text>in</xsl:text>
                          </Top>
                          <Left>1.5in</Left>
                          <Height>
                            <xsl:value-of select="$ElementHeight - 0.05"/>
                            <xsl:text>in</xsl:text>
                          </Height>
                          <Width>
                            <xsl:value-of select="$ReportWidth - 1.5"/>
                            <xsl:text>in</xsl:text>
                          </Width>
                          <Style>
                            <Border>
                              <Style>None</Style>
                            </Border>
                            <PaddingBottom>2pt</PaddingBottom>
                          </Style>
                        </Image>
                      </xsl:if>
                    </xsl:for-each>
                  </ReportItems>
                  <KeepTogether>true</KeepTogether>
                </Rectangle>
              </CellContents>
            </TablixCell>
          </TablixCells>
        </TablixRow>
      </TablixRows>
    </TablixBody>
    <TablixColumnHierarchy>
      <TablixMembers>
        <TablixMember />
      </TablixMembers>
    </TablixColumnHierarchy>
    <TablixRowHierarchy>
      <TablixMembers>
        <TablixMember>
          <Group Name="Details" />
        </TablixMember>
      </TablixMembers>
    </TablixRowHierarchy>
  </xsl:template>

  <xsl:template name="RenderImageValue">
    <xsl:param name="Field"/>
    <Source>External</Source>
    <!-- =CStr(Parameters!BaseUrl) & "/Blob.ashx?EmployeesPhoto=t|" & CStr(Fields!EmployeeID.Value) -->
    <Value>
      <xsl:text>=CStr(Parameters!BaseUrl.Value)</xsl:text>
      <xsl:text> &amp; "/Blob.ashx?</xsl:text>
      <xsl:value-of select="$Field/@onDemandHandler"/>
      <xsl:text>=</xsl:text>
      <xsl:choose>
        <xsl:when test="$Field/@onDemandStyle='Thumbnail'">
          <xsl:text>t</xsl:text>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>o</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:text>|"</xsl:text>
      <xsl:for-each select="$Field/parent::a:fields/a:field[@isPrimaryKey='true']">
        <xsl:if test="position()>1">
          <xsl:text> &amp; ","</xsl:text>
        </xsl:if>
        <xsl:text> &amp; </xsl:text>
        <xsl:choose>
          <xsl:when test="@type='Guid'">
            <xsl:text>Fields!</xsl:text>
            <xsl:value-of select="@name"/>
            <xsl:text>.Value.ToString()</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>CStr(Fields!</xsl:text>
            <xsl:value-of select="@name"/>
            <xsl:text>.Value)</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:for-each>
    </Value>
  </xsl:template>

  <xsl:template name="RenderFormFieldAttributes">
    <Border>
      <Style>None</Style>
    </Border>
    <xsl:choose>
      <xsl:when test="position()=1">
        <TopBorder>
          <Style>Solid</Style>
          <Width>2pt</Width>
        </TopBorder>
      </xsl:when>
      <xsl:otherwise>
        <TopBorder>
          <Style>Solid</Style>
          <Width>0.5pt</Width>
          <Color>Silver</Color>
        </TopBorder>
      </xsl:otherwise>
    </xsl:choose>
    <PaddingLeft>2pt</PaddingLeft>
    <PaddingRight>2pt</PaddingRight>
    <PaddingTop>2pt</PaddingTop>
    <PaddingBottom>2pt</PaddingBottom>
  </xsl:template>

  <xsl:template name="RenderGridTablixBody">
    <xsl:param name="DataFields"/>
    <xsl:param name="Fields"/>
    <xsl:param name="ReportWidth"/>
    <xsl:param name="AggregateFields"/>
    <TablixBody>
      <TablixColumns>
        <xsl:call-template name="RenderTabixElement">
          <xsl:with-param name="DataFields" select="$DataFields"/>
          <xsl:with-param name="Fields" select="$Fields"/>
          <xsl:with-param name="ReportWidth" select="$ReportWidth"/>
          <xsl:with-param name="Element" select="'TablixColumn'"/>
        </xsl:call-template>
      </TablixColumns>
      <TablixRows>
        <TablixRow>
          <Height>
            <xsl:value-of select="$ElementHeight"/>
            <xsl:text>in</xsl:text>
          </Height>
          <TablixCells>
            <xsl:call-template name="RenderTabixElement">
              <xsl:with-param name="DataFields" select="$DataFields"/>
              <xsl:with-param name="Fields" select="$Fields"/>
              <xsl:with-param name="ReportWidth" select="$ReportWidth"/>
              <xsl:with-param name="Element" select="'ColumnHeader'"/>
            </xsl:call-template>
          </TablixCells>
        </TablixRow>
        <TablixRow>
          <Height>
            <xsl:value-of select="$ElementHeight + $ElementHeightDelta"/>
            <xsl:text>in</xsl:text>
          </Height>
          <TablixCells>
            <xsl:call-template name="RenderTabixElement">
              <xsl:with-param name="DataFields" select="$DataFields"/>
              <xsl:with-param name="Fields" select="$Fields"/>
              <xsl:with-param name="ReportWidth" select="$ReportWidth"/>
              <xsl:with-param name="Element" select="'ColumnData'"/>
            </xsl:call-template>
          </TablixCells>
        </TablixRow>
        <xsl:if test="$AggregateFields">
          <TablixRow>
            <Height>
              <xsl:value-of select="$ElementHeight"/>
              <xsl:text>in</xsl:text>
            </Height>
            <TablixCells>
              <xsl:call-template name="RenderTabixElement">
                <xsl:with-param name="DataFields" select="$DataFields"/>
                <xsl:with-param name="Fields" select="$Fields"/>
                <xsl:with-param name="ReportWidth" select="$ReportWidth"/>
                <xsl:with-param name="Element" select="'ColumnAggregate'"/>
                <xsl:with-param name="AggregateFields" select="$AggregateFields"/>
              </xsl:call-template>
            </TablixCells>
          </TablixRow>
        </xsl:if>
      </TablixRows>
    </TablixBody>
    <TablixColumnHierarchy>
      <TablixMembers>
        <xsl:call-template name="RenderTabixElement">
          <xsl:with-param name="DataFields" select="$DataFields"/>
          <xsl:with-param name="Fields" select="$Fields"/>
          <xsl:with-param name="ReportWidth" select="$ReportWidth"/>
          <xsl:with-param name="Element" select="'ColumnHierarchyMember'"/>
        </xsl:call-template>
      </TablixMembers>
    </TablixColumnHierarchy>
    <TablixRowHierarchy>
      <TablixMembers>
        <TablixMember>
          <KeepWithGroup>After</KeepWithGroup>
          <RepeatOnNewPage>true</RepeatOnNewPage>
        </TablixMember>
        <TablixMember>
          <Group Name="Details" />
          <TablixMembers>
            <TablixMember />
          </TablixMembers>
        </TablixMember>
        <xsl:if test="$AggregateFields">
          <TablixMember>
            <KeepWithGroup>Before</KeepWithGroup>
          </TablixMember>
        </xsl:if>
      </TablixMembers>
    </TablixRowHierarchy>
  </xsl:template>

  <xsl:template name="RenderTabixElement">
    <xsl:param name="Element"/>
    <xsl:param name="DataFields"/>
    <xsl:param name="Fields"/>
    <xsl:param name="ReportWidth"/>
    <xsl:param name="AggregateFields"/>
    <xsl:variable name="TotalColumns" select="sum($DataFields[@columns>=$MinimumFieldColumns]/@columns) + count($DataFields[@columns &lt; $MinimumFieldColumns])*$MinimumFieldColumns + count($DataFields[not(@columns)])*$DefaultFieldColumns"/>
    <xsl:for-each select="$DataFields">
      <xsl:variable name="Field" select="$Fields[(current()/@aliasFieldName and @name = current()/@aliasFieldName) or (not(current()/@aliasFieldName) and current()/@fieldName = @name)]"/>
      <xsl:variable name="FieldColumns">
        <xsl:choose>
          <xsl:when test="@columns>$MinimumFieldColumns">
            <xsl:value-of select="@columns"/>
          </xsl:when>
          <xsl:when test="@columns">
            <xsl:value-of select="$MinimumFieldColumns"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="$DefaultFieldColumns"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:variable>
      <xsl:variable name="PrecedingColumns" select="sum(preceding-sibling::*[@columns>=$MinimumFieldColumns and not(@hidden='true')]/@columns) + count(preceding-sibling::*[@columns &lt; $MinimumFieldColumns and not(@hidden='true')])*$MinimumFieldColumns + count(preceding-sibling::*[not(@columns) and not(@hidden='true')])*$DefaultFieldColumns"/>
      <xsl:variable name="Left" select="$ReportWidth * $PrecedingColumns div $TotalColumns"/>
      <xsl:variable name="Height" select="0.20"/>
      <xsl:variable name="Width" select="$ReportWidth * $FieldColumns div $TotalColumns"/>
      <xsl:choose>
        <xsl:when test="$Element='TablixColumn'">
          <TablixColumn>
            <Width>
              <xsl:value-of select="$Width"/>
              <xsl:text>in</xsl:text>
            </Width>
          </TablixColumn>
        </xsl:when>
        <xsl:when test="$Element='ColumnHeader'">
          <TablixCell>
            <CellContents>
              <Textbox Name="{@fieldName}HeaderTextBox">
                <CanGrow>true</CanGrow>
                <KeepTogether>true</KeepTogether>
                <Paragraphs>
                  <Paragraph>
                    <TextRuns>
                      <TextRun>
                        <Value>
                          <xsl:choose>
                            <xsl:when test="a:headerText!=''">
                              <xsl:value-of select="a:headerText"/>
                            </xsl:when>
                            <xsl:otherwise>
                              <xsl:value-of select="$Field/@label"/>
                            </xsl:otherwise>
                          </xsl:choose>
                        </Value>
                        <Style>
                          <FontSize>
                            <xsl:value-of select="$FontSize"/>
                          </FontSize>
                          <FontWeight>Bold</FontWeight>
                        </Style>
                      </TextRun>
                    </TextRuns>
                    <Style>
                      <TextAlign>
                        <xsl:choose>
                          <xsl:when test="$Field/a:items/a:item">Left</xsl:when>
                          <xsl:when test="$Field/@type='Boolean'">
                            <xsl:text>Center</xsl:text>
                          </xsl:when>
                          <xsl:when test="$Field/@type[not(.='String' or .='DateTime')] and not($Field[@onDemand='true'])">
                            <xsl:text>Right</xsl:text>
                          </xsl:when>
                          <xsl:otherwise>
                            <xsl:text>Left</xsl:text>
                          </xsl:otherwise>
                        </xsl:choose>
                      </TextAlign>
                    </Style>
                  </Paragraph>
                </Paragraphs>
                <Style>
                  <Border>
                    <Style>None</Style>
                  </Border>
                  <BottomBorder>
                    <Style>Solid</Style>
                  </BottomBorder>
                  <PaddingLeft>2pt</PaddingLeft>
                  <PaddingRight>2pt</PaddingRight>
                  <PaddingTop>2pt</PaddingTop>
                  <PaddingBottom>2pt</PaddingBottom>
                </Style>
              </Textbox>
            </CellContents>
          </TablixCell>
        </xsl:when>
        <xsl:when test="$Element='ColumnData'">
          <!--<xsl:variable name="DataFormatString">
            <xsl:choose>
              <xsl:when test="@dataFormatString!=''">
                <xsl:value-of select="@dataFormatString"/>
              </xsl:when>
              <xsl:when test="not($Field/@dataFormatString!='') and starts-with($Field/@type, 'Date')">
                <xsl:text>d</xsl:text>
              </xsl:when>
              <xsl:otherwise>
                <xsl:value-of select="$Field/@dataFormatString"/>
              </xsl:otherwise>
            </xsl:choose>
          </xsl:variable>-->
          <TablixCell>
            <CellContents>
              <xsl:choose>
                <xsl:when test="$Field/@onDemand='true'">
                  <Image Name="{$Field/@name}Image">
                    <xsl:call-template name="RenderImageValue">
                      <xsl:with-param name="Field" select="$Field"/>
                    </xsl:call-template>
                    <Sizing>FitProportional</Sizing>
                    <Style>
                      <Border>
                        <Color>LightGrey</Color>
                        <Style>None</Style>
                      </Border>
                      <BottomBorder>
                        <Style>Solid</Style>
                        <Width>0.5pt</Width>
                      </BottomBorder>
                      <PaddingLeft>2pt</PaddingLeft>
                      <PaddingRight>2pt</PaddingRight>
                      <PaddingTop>2pt</PaddingTop>
                      <PaddingBottom>2pt</PaddingBottom>
                    </Style>
                  </Image>
                </xsl:when>
                <xsl:otherwise>
                  <Textbox Name="{@fieldName}DataTextBox">
                    <CanGrow>true</CanGrow>
                    <KeepTogether>true</KeepTogether>
                    <Paragraphs>
                      <Paragraph>
                        <TextRuns>
                          <TextRun>
                            <xsl:call-template name="RenderFieldTextRunValue">
                              <xsl:with-param name="Field" select="$Field"/>
                            </xsl:call-template>
                            <Style>
                              <FontSize>
                                <xsl:value-of select="$FontSize"/>
                              </FontSize>
                            </Style>
                          </TextRun>
                        </TextRuns>
                        <Style>
                          <TextAlign>
                            <xsl:choose>
                              <xsl:when test="$Field/a:items/a:item">Left</xsl:when>
                              <xsl:when test="$Field/@type='Boolean'">
                                <xsl:text>Center</xsl:text>
                              </xsl:when>
                              <xsl:when test="$Field/@type[not(.='String' or .='DateTime')]">
                                <xsl:text>Right</xsl:text>
                              </xsl:when>
                              <xsl:otherwise>
                                <xsl:text>Left</xsl:text>
                              </xsl:otherwise>
                            </xsl:choose>
                          </TextAlign>
                        </Style>
                      </Paragraph>
                    </Paragraphs>
                    <Style>
                      <Border>
                        <Color>LightGrey</Color>
                        <Style>None</Style>
                      </Border>
                      <BottomBorder>
                        <Style>Solid</Style>
                        <Width>0.5pt</Width>
                      </BottomBorder>
                      <PaddingLeft>2pt</PaddingLeft>
                      <PaddingRight>2pt</PaddingRight>
                      <PaddingTop>2pt</PaddingTop>
                      <PaddingBottom>2pt</PaddingBottom>
                    </Style>
                  </Textbox>
                </xsl:otherwise>
              </xsl:choose>
            </CellContents>
          </TablixCell>
        </xsl:when>
        <xsl:when test="$Element='ColumnAggregate'">
          <xsl:variable name="AggregateField" select="$AggregateFields[@fieldName=current()/@fieldName]"/>
          <xsl:variable name="DataFormatString">
            <xsl:choose>
              <xsl:when test="starts-with($Field/@type, 'Date')">
                <xsl:text></xsl:text>
              </xsl:when>
              <xsl:when test="@dataFormatString!=''">
                <xsl:value-of select="@dataFormatString"/>
              </xsl:when>
              <xsl:otherwise>
                <xsl:value-of select="$AggregateField/@dataFormatString"/>
              </xsl:otherwise>
            </xsl:choose>
          </xsl:variable>
          <TablixCell>
            <CellContents>
              <Textbox Name="{@fieldName}AggregateTextBox">
                <CanGrow>true</CanGrow>
                <KeepTogether>true</KeepTogether>
                <Paragraphs>
                  <Paragraph>
                    <TextRuns>
                      <TextRun>
                        <Value>
                          <xsl:if test="$AggregateField">
                            <xsl:variable name="AggregateFunction">
                              <xsl:choose>
                                <xsl:when test="$AggregateField/@aggregate='Average'">
                                  <xsl:text>Avg</xsl:text>
                                </xsl:when>
                                <xsl:when test="$AggregateField/@aggregate='Count'">
                                  <xsl:text>CountDistinct</xsl:text>
                                </xsl:when>
                                <xsl:otherwise>
                                  <xsl:value-of select="$AggregateField/@aggregate"/>
                                </xsl:otherwise>
                              </xsl:choose>
                            </xsl:variable>
                            <xsl:variable name="dfs">
                              <xsl:choose>
                                <xsl:when test="contains($DataFormatString, '{')">
                                  <xsl:value-of select="$DataFormatString"/>
                                </xsl:when>
                                <xsl:otherwise>
                                  <xsl:text>{0:</xsl:text>
                                  <xsl:value-of select="$DataFormatString"/>
                                  <xsl:text>}</xsl:text>
                                </xsl:otherwise>
                              </xsl:choose>
                            </xsl:variable>
                            <xsl:text>=String.Format("</xsl:text>
                            <xsl:choose>
                              <xsl:when test="$AggregateFunction='CountDistinct'">
                                <xsl:text>Count</xsl:text>
                              </xsl:when>
                              <xsl:otherwise>
                                <xsl:value-of select="$AggregateFunction"/>
                              </xsl:otherwise>
                            </xsl:choose>
                            <xsl:text>: </xsl:text>
                            <xsl:value-of select="$dfs"/>
                            <xsl:text>", </xsl:text>
                            <xsl:value-of select="$AggregateFunction"/>
                            <xsl:text>(Fields!</xsl:text>
                            <xsl:value-of select="$Field/@name"/>
                            <xsl:text>.Value))</xsl:text>
                          </xsl:if>
                        </Value>
                        <Style>
                          <FontSize>
                            <xsl:value-of select="$FontSize"/>
                          </FontSize>
                          <FontWeight>Bold</FontWeight>
                        </Style>
                      </TextRun>
                    </TextRuns>
                    <Style>
                      <TextAlign>
                        <xsl:choose>
                          <xsl:when test="$Field/a:items/a:item">Left</xsl:when>
                          <xsl:when test="$Field/@type='Boolean'">
                            <xsl:text>Center</xsl:text>
                          </xsl:when>
                          <xsl:when test="$Field/@type[not(.='String' or .='DateTime')]">
                            <xsl:text>Right</xsl:text>
                          </xsl:when>
                          <xsl:otherwise>
                            <xsl:text>Left</xsl:text>
                          </xsl:otherwise>
                        </xsl:choose>
                      </TextAlign>
                    </Style>
                  </Paragraph>
                </Paragraphs>
                <Style>
                  <Border>
                    <Color>Black</Color>
                    <Style>None</Style>
                  </Border>
                  <BottomBorder>
                    <Style>Solid</Style>
                    <Width>2pt</Width>
                  </BottomBorder>
                  <TopBorder>
                    <Style>Solid</Style>
                  </TopBorder>
                  <PaddingLeft>2pt</PaddingLeft>
                  <PaddingRight>2pt</PaddingRight>
                  <PaddingTop>2pt</PaddingTop>
                  <PaddingBottom>2pt</PaddingBottom>
                </Style>
              </Textbox>
            </CellContents>
          </TablixCell>
        </xsl:when>
        <xsl:when test="$Element='ColumnHierarchyMember'">
          <TablixMember/>
        </xsl:when>
      </xsl:choose>
    </xsl:for-each>
  </xsl:template>

  <xsl:template name="RenderFieldTextRunValue">
    <xsl:param name="Field"/>
    <xsl:choose>
      <xsl:when test="not($Field[@onDemand='true'])">
        <xsl:variable name="DataFormatString">
          <xsl:choose>
            <xsl:when test="$Field/@formatOnClient='false'">
              <xsl:value-of select="$Field/@dataFormatString"/>
            </xsl:when>
            <xsl:when test="@dataFormatString!=''">
              <xsl:value-of select="@dataFormatString"/>
            </xsl:when>
            <xsl:when test="not($Field/@dataFormatString!='') and starts-with($Field/@type, 'Date')">
              <xsl:text>d</xsl:text>
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="$Field/@dataFormatString"/>
            </xsl:otherwise>
          </xsl:choose>
        </xsl:variable>
        <Value>
          <xsl:choose>
            <xsl:when test="$Field/a:items/a:item">
              <xsl:text>=Code.ValueToText(Fields!</xsl:text>
              <xsl:value-of select="$Field/@name"/>
              <xsl:text>.Value</xsl:text>
              <xsl:for-each select="$Field/a:items/a:item">
                <xsl:text>, "</xsl:text>
                <xsl:value-of select="@value"/>
                <xsl:text>", "</xsl:text>
                <xsl:value-of select="@text"/>
                <xsl:text>"</xsl:text>
              </xsl:for-each>
              <xsl:text>)</xsl:text>
            </xsl:when>
            <xsl:when test="$DataFormatString!=''">
              <xsl:variable name="dfs">
                <xsl:choose>
                  <xsl:when test="contains($DataFormatString, '{')">
                    <xsl:value-of select="$DataFormatString"/>
                  </xsl:when>
                  <xsl:otherwise>
                    <xsl:text>{0:</xsl:text>
                    <xsl:value-of select="$DataFormatString"/>
                    <xsl:text>}</xsl:text>
                  </xsl:otherwise>
                </xsl:choose>
              </xsl:variable>
              <xsl:text>=String.Format("</xsl:text>
              <xsl:value-of select="$dfs"/>
              <xsl:text>", Fields!</xsl:text>
              <xsl:value-of select="$Field/@name"/>
              <xsl:text>.Value)</xsl:text>
            </xsl:when>
            <xsl:when test="$Field/@type='Boolean'">
              <xsl:text>=IIf(Fields!</xsl:text>
              <xsl:value-of select="$Field/@name"/>
              <xsl:text>.Value = True, "^Yes^Yes^Yes^", "^No^No^No^")</xsl:text>
            </xsl:when>
            <xsl:otherwise>
              <xsl:text>=Fields!</xsl:text>
              <xsl:value-of select="$Field/@name"/>
              <xsl:text>.Value</xsl:text>
            </xsl:otherwise>
          </xsl:choose>
        </Value>
        <xsl:if test="@textMode='RichText' or @rows > 2">
          <MarkupType>HTML</MarkupType>
        </xsl:if>
      </xsl:when>
      <xsl:otherwise>
        <Value>= " "</Value>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>
