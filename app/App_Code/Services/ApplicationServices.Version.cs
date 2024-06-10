namespace MyCompany.Services
{


    public partial class ApplicationServices
    {

        /// The first three numbers in the version reflect the version of the app generator.
        /// The last number is the value stored in DataAquarium.Version.xml file located in the root of the project.
        /// The number is automatically incremented when the application is published from the app generator.
        public static string Version;

        /// The version reported to mobile clients adding this application.
        public static string HostVersion;
    }
}
